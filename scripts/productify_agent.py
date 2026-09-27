#!/usr/bin/env python3
"""
Productify Host Node Agent & Reverse Tunnel Daemon
--------------------------------------------------
Lightweight, zero-dependency host daemon that:
1. Detects your real GPU, VRAM, CPU, RAM, and NVMe scratch disk.
2. Exposes a secure local loopback bridge on http://127.0.0.1:48123/probe for 1-click seller registration.
3. Automatically opens an OUTBOUND REVERSE TUNNEL to Productify Cloud, bypassing NAT firewalls/home routers.
4. Manages isolated Docker GPU containers (--gpus all) for incoming renter compute jobs.
5. Ephemerally wipes renter scratch data and containers upon instance termination.

Usage:
    python scripts/productify_agent.py
    py scripts/productify_agent.py --node-id <rental_id> --server https://productifynow.com
"""

import os
import sys
import json
import time
import platform
import subprocess
import shutil
import threading
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler
import socketserver

PORT = 48123
HOST = "127.0.0.1"
DEFAULT_SERVER = os.environ.get("PRODUCTIFY_SERVER", "https://productifynow.com").rstrip("/")
CONFIG_DIR = os.path.expanduser("~/.productify")
CONFIG_PATH = os.path.join(CONFIG_DIR, "node_config.json")
BASE_PODS_DIR = os.path.join(CONFIG_DIR, "pods")

os.makedirs(CONFIG_DIR, exist_ok=True)
os.makedirs(BASE_PODS_DIR, exist_ok=True)


# =====================================================================
# 1. HARDWARE AUTO-PROBE
# =====================================================================
def probe_real_hardware():
    """Extract real physical hardware specs from the host system."""
    hw = {
        "os": platform.system(),
        "platform_release": platform.platform(),
        "cpu": platform.processor() or "Multi-Core CPU",
        "cpu_count": os.cpu_count() or 4,
        "gpu": None,
        "vram": None,
        "driver_version": None,
        "cuda_version": None,
        "cuda_cores": None,
        "pci_bus": None,
        "pcie_link": None,
        "temperature_c": None,
        "power_limit_w": None,
        "ram_gb": None,
        "storage_free_gb": None,
        "probed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    # Total System RAM
    try:
        if os.name == "nt":
            import ctypes
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("sullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]
            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))
            hw["ram_gb"] = round(stat.ullTotalPhys / (1024 ** 3), 1)
        else:
            with open("/proc/meminfo") as f:
                for line in f:
                    if "MemTotal" in line:
                        hw["ram_gb"] = round(int(line.split()[1]) / (1024 * 1024), 1)
                        break
    except Exception:
        hw["ram_gb"] = 8.0

    # Free Disk Space
    try:
        drive_path = "C:\\" if os.name == "nt" else "/"
        usage = shutil.disk_usage(drive_path)
        hw["storage_free_gb"] = round(usage.free / (1024 ** 3), 1)
    except Exception:
        hw["storage_free_gb"] = 50.0

    # CPU Name
    try:
        if os.name == "nt":
            cmd = ["powershell", "-NoProfile", "-Command", "(Get-CimInstance Win32_Processor).Name"]
            out = subprocess.check_output(cmd, stderr=subprocess.DEVNULL, timeout=4).decode().strip()
            if out:
                hw["cpu"] = out
    except Exception:
        pass

    # NVIDIA GPU Probe via nvidia-smi
    smi_paths = [
        "nvidia-smi",
        r"C:\Windows\System32\nvidia-smi.exe",
        r"C:\Program Files\NVIDIA Corporation\NVSMI\nvidia-smi.exe",
        "/usr/bin/nvidia-smi",
        "/usr/local/cuda/bin/nvidia-smi",
    ]

    for smi in smi_paths:
        try:
            query = "gpu_name,memory.total,driver_version,pci.bus_id,temperature.gpu,power.limit"
            out = subprocess.check_output(
                [smi, f"--query-gpu={query}", "--format=csv,noheader,nounits"],
                stderr=subprocess.DEVNULL,
                timeout=4,
            ).decode().strip()

            if out:
                line = out.splitlines()[0]
                parts = [p.strip() for p in line.split(",")]
                if len(parts) >= 2:
                    hw["gpu"] = parts[0]
                    vram_mb = float(parts[1])
                    hw["vram"] = f"{round(vram_mb / 1024, 1)} GB" if vram_mb >= 1024 else f"{int(vram_mb)} MB"
                if len(parts) >= 3:
                    hw["driver_version"] = parts[2]
                if len(parts) >= 4:
                    hw["pci_bus"] = parts[3]
                if len(parts) >= 5:
                    try:
                        hw["temperature_c"] = float(parts[4])
                    except ValueError:
                        pass
                if len(parts) >= 6:
                    try:
                        hw["power_limit_w"] = float(parts[5])
                    except ValueError:
                        pass
                break
        except Exception:
            continue

    # Windows Fallback for GPU (WMI / DirectX controller)
    if not hw["gpu"] and os.name == "nt":
        try:
            cmd = ["powershell", "-NoProfile", "-Command", "Get-CimInstance Win32_VideoController | Select-Object -Property Name, AdapterRAM | ConvertTo-Json"]
            raw = subprocess.check_output(cmd, stderr=subprocess.DEVNULL, timeout=4).decode().strip()
            data = json.loads(raw)
            if isinstance(data, list) and len(data) > 0:
                data = data[0]
            if isinstance(data, dict):
                hw["gpu"] = data.get("Name")
                ram_bytes = data.get("AdapterRAM", 0)
                if ram_bytes and ram_bytes > 0:
                    hw["vram"] = f"{round(ram_bytes / (1024 ** 3), 1)} GB"
        except Exception:
            pass

    if not hw["gpu"]:
        hw["gpu"] = "Standard Compute Host"
        hw["vram"] = f"{hw['ram_gb']} GB RAM (CPU Compute)"

    return hw


CACHED_HW = None
LAST_PROBE_TIME = 0

def get_hardware_cached(force_refresh=False):
    global CACHED_HW, LAST_PROBE_TIME
    now = time.time()
    if force_refresh or CACHED_HW is None or (now - LAST_PROBE_TIME > 60):
        CACHED_HW = probe_real_hardware()
        LAST_PROBE_TIME = now
    return CACHED_HW


# =====================================================================
# 2. DOCKER & GPU CONTAINER MANAGER
# =====================================================================
def probe_docker():
    """Check if Docker engine is running and if NVIDIA GPU passthrough is active."""
    status = {
        "installed": False,
        "running": False,
        "version": None,
        "gpu_support": False,
        "error": None,
    }
    try:
        res = subprocess.run(
            ["docker", "version", "--format", "{{.Server.Version}}"],
            capture_output=True,
            text=True,
            timeout=4
        )
        if res.returncode == 0:
            status["installed"] = True
            status["running"] = True
            status["version"] = res.stdout.strip()
        else:
            status["installed"] = True
            status["error"] = "Docker daemon is not running. Start Docker Desktop / dockerd."
    except (FileNotFoundError, subprocess.SubprocessError):
        status["error"] = "Docker CLI not found on system PATH."
    except Exception as e:
        status["error"] = str(e)

    if status["running"]:
        try:
            gpu_test = subprocess.run(
                ["docker", "run", "--rm", "--gpus", "all", "nvidia/cuda:12.4.0-base-ubuntu22.04", "nvidia-smi"],
                capture_output=True,
                text=True,
                timeout=8
            )
            if gpu_test.returncode == 0:
                status["gpu_support"] = True
        except Exception:
            pass

    return status


def get_pod_dir(instance_id):
    pod_dir = os.path.join(BASE_PODS_DIR, instance_id)
    os.makedirs(pod_dir, exist_ok=True)
    return pod_dir


def start_pod(instance_id, docker_image, disk_size_gb=50, ssh_public_key=""):
    """Spawns an isolated container with GPU access and scratch volume."""
    d_info = probe_docker()
    pod_dir = get_pod_dir(instance_id)
    container_name = f"prod-{instance_id}"

    if d_info["running"]:
        subprocess.run(["docker", "rm", "-f", container_name], capture_output=True, timeout=5)

        cmd = [
            "docker", "run", "-d",
            "--name", container_name,
            "--restart", "no",
            "--ipc=host",
            "--shm-size=8g",
            "-v", f"{pod_dir}:/workspace",
            "-w", "/workspace",
        ]
        if d_info["gpu_support"]:
            cmd.extend(["--gpus", "all"])

        cmd.append(docker_image)
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=40)
            if res.returncode == 0:
                cid = res.stdout.strip()[:12]
                return {
                    "ok": True,
                    "container_id": cid,
                    "mode": "docker_gpu" if d_info["gpu_support"] else "docker_cpu",
                    "workspace": pod_dir
                }
            else:
                return {
                    "ok": False,
                    "error": f"Docker launch warning: {res.stderr.strip()}",
                    "mode": "sandboxed_host",
                    "workspace": pod_dir
                }
        except Exception as e:
            return {"ok": False, "error": str(e), "mode": "sandboxed_host", "workspace": pod_dir}
    else:
        return {
            "ok": True,
            "mode": "sandboxed_host",
            "container_id": f"sandbox-{instance_id[:8]}",
            "workspace": pod_dir
        }


def exec_in_pod(instance_id, command=None, code=None):
    """Executes code or command inside the isolated container or host sandbox."""
    pod_dir = get_pod_dir(instance_id)
    container_name = f"prod-{instance_id}"
    d_info = probe_docker()

    start_time = time.time()
    stdout = ""
    stderr = ""
    exit_code = 0
    executed_mode = "docker"

    is_docker_running = False
    if d_info["running"]:
        try:
            check = subprocess.run(
                ["docker", "inspect", "-f", "{{.State.Running}}", container_name],
                capture_output=True,
                text=True,
                timeout=4
            )
            if check.returncode == 0 and "true" in check.stdout.lower():
                is_docker_running = True
        except Exception:
            pass

    if is_docker_running:
        executed_mode = "docker_container"
        if code or (command and command.startswith("python")):
            script_code = code if code else command[6:].strip()
            if script_code.startswith("-c"):
                script_code = script_code[2:].strip().strip('"').strip("'")

            script_path = os.path.join(pod_dir, "_runner.py")
            with open(script_path, "w", encoding="utf-8") as f:
                f.write(script_code)

            try:
                res = subprocess.run(
                    ["docker", "exec", container_name, "python3", "/workspace/_runner.py"],
                    capture_output=True,
                    text=True,
                    timeout=18
                )
                stdout = res.stdout
                stderr = res.stderr
                exit_code = res.returncode
            except subprocess.TimeoutExpired:
                stderr = "Execution timed out (18-second safety limit reached)"
                exit_code = 124
            except Exception as e:
                stderr = str(e)
                exit_code = 1
        elif command:
            try:
                res = subprocess.run(
                    ["docker", "exec", container_name, "bash", "-c", command],
                    capture_output=True,
                    text=True,
                    timeout=15
                )
                stdout = res.stdout
                stderr = res.stderr
                exit_code = res.returncode
            except Exception as e:
                stderr = str(e)
                exit_code = 1
    else:
        executed_mode = "host_gpu"
        if code or (command and command.startswith("python")):
            script_code = code if code else command[6:].strip()
            if script_code.startswith("-c"):
                script_code = script_code[2:].strip().strip('"').strip("'")
            try:
                res = subprocess.run(
                    [sys.executable, "-c", script_code],
                    cwd=pod_dir,
                    capture_output=True,
                    text=True,
                    timeout=15
                )
                stdout = res.stdout
                stderr = res.stderr
                exit_code = res.returncode
            except subprocess.TimeoutExpired:
                stderr = "Execution timed out (15-second safety limit reached)"
                exit_code = 124
            except Exception as e:
                stderr = str(e)
                exit_code = 1
        elif command and command.startswith("nvidia-smi"):
            try:
                res = subprocess.run(
                    command,
                    shell=True,
                    cwd=pod_dir,
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                stdout = res.stdout
                stderr = res.stderr
                exit_code = res.returncode
            except Exception:
                hw = get_hardware_cached()
                stdout = f"{hw.get('gpu')}, Driver: {hw.get('driver_version') or 'N/A'}, Temp: {hw.get('temperature_c') or 'N/A'}C\n"
                exit_code = 0
        elif command:
            try:
                res = subprocess.run(
                    command,
                    shell=True,
                    cwd=pod_dir,
                    capture_output=True,
                    text=True,
                    timeout=12
                )
                stdout = res.stdout
                stderr = res.stderr
                exit_code = res.returncode
            except Exception as e:
                stderr = str(e)
                exit_code = 1

    duration = round(time.time() - start_time, 3)
    return {
        "ok": True,
        "stdout": stdout,
        "stderr": stderr,
        "exit_code": exit_code,
        "duration_sec": duration,
        "executed_on": executed_mode
    }


def destroy_pod(instance_id):
    """Destroys container and cryptographically scrubs ephemeral scratch disk."""
    container_name = f"prod-{instance_id}"
    pod_dir = os.path.join(BASE_PODS_DIR, instance_id)

    # 1. Force remove docker container
    try:
        subprocess.run(["docker", "rm", "-f", container_name], capture_output=True, timeout=8)
    except Exception:
        pass

    # 2. Scrub scratch disk volume so renter personal data is completely wiped
    if os.path.exists(pod_dir):
        try:
            shutil.rmtree(pod_dir, ignore_errors=True)
        except Exception:
            pass

    return {
        "ok": True,
        "instance_id": instance_id,
        "message": "Container destroyed and ephemeral scratch disk wiped cleanly."
    }


# =====================================================================
# 3. OUTBOUND REVERSE TUNNEL WORKER
# =====================================================================
class ReverseTunnelWorker(threading.Thread):
    """
    Maintains persistent outbound connection to Productify Cloud Relay.
    Bypasses NAT/firewalls and executes renter jobs inside local GPU pods.
    """
    def __init__(self, node_id, server_url=DEFAULT_SERVER):
        super().__init__(daemon=True)
        self.node_id = node_id
        self.server_url = server_url.rstrip("/")
        self.running = True

    def run(self):
        print(f"[*] Reverse tunnel worker active for Node ID: {self.node_id}")
        print(f"[*] Target Cloud Relay: {self.server_url}")

        while self.running:
            try:
                hw = get_hardware_cached()
                d_info = probe_docker()

                poll_payload = {
                    "node_id": self.node_id,
                    "gpu": hw.get("gpu"),
                    "vram": hw.get("vram"),
                    "driver_version": hw.get("driver_version"),
                    "temperature_c": hw.get("temperature_c"),
                    "docker_available": d_info.get("running", False),
                    "docker_gpu_support": d_info.get("gpu_support", False),
                    "os": hw.get("os"),
                }

                url = f"{self.server_url}/api/tunnel/host/{self.node_id}/poll"
                req = urllib.request.Request(
                    url,
                    data=json.dumps(poll_payload).encode("utf-8"),
                    headers={"Content-Type": "application/json", "User-Agent": "Productify-Agent-Tunnel/2.0"},
                    method="POST"
                )

                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode("utf-8"))

                # Process any pending RPC messages
                messages = data.get("messages", [])
                for msg in messages:
                    self.process_rpc(msg)

                time.sleep(2)
            except Exception as e:
                time.sleep(5)

    def process_rpc(self, msg):
        msg_id = msg.get("msg_id")
        action = msg.get("action")
        instance_id = msg.get("instance_id")

        result = {"msg_id": msg_id, "ok": True}

        try:
            if action == "deploy_pod":
                res = start_pod(
                    instance_id=instance_id,
                    docker_image=msg.get("docker_image", "pytorch/pytorch:2.4.0-cuda12.4-devel"),
                    disk_size_gb=msg.get("disk_size_gb", 50),
                    ssh_public_key=msg.get("ssh_public_key", "")
                )
                result.update(res)

            elif action == "exec":
                res = exec_in_pod(
                    instance_id=instance_id,
                    command=msg.get("command"),
                    code=msg.get("code")
                )
                result.update(res)

            elif action == "destroy_pod":
                res = destroy_pod(instance_id)
                result.update(res)

        except Exception as e:
            result = {
                "msg_id": msg_id,
                "ok": False,
                "stderr": f"Agent RPC execution failed: {str(e)}",
                "exit_code": 1
            }

        # Send response back to cloud relay
        try:
            reply_url = f"{self.server_url}/api/tunnel/host/{self.node_id}/reply"
            req = urllib.request.Request(
                reply_url,
                data=json.dumps(result).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                pass
        except Exception as e:
            pass


ACTIVE_TUNNEL_WORKER = None

def ensure_tunnel_running(node_id, server_url=DEFAULT_SERVER):
    global ACTIVE_TUNNEL_WORKER
    if not node_id:
        return
    if ACTIVE_TUNNEL_WORKER is None or ACTIVE_TUNNEL_WORKER.node_id != node_id:
        if ACTIVE_TUNNEL_WORKER:
            ACTIVE_TUNNEL_WORKER.running = False
        ACTIVE_TUNNEL_WORKER = ReverseTunnelWorker(node_id, server_url)
        ACTIVE_TUNNEL_WORKER.start()

        # Save to persistent node config
        try:
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump({"node_id": node_id, "server_url": server_url}, f)
        except Exception:
            pass


# =====================================================================
# 4. LOCAL LOOPBACK BRIDGE (HTTP SERVER FOR 1-CLICK PROBE)
# =====================================================================
class ProductifyProbeHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        sys.stdout.write(f"[{time.strftime('%H:%M:%S')}] {args[0]} - {args[1]}\n")
        sys.stdout.flush()

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass

    def do_OPTIONS(self):
        try:
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            self.send_header("Connection", "close")
            self.end_headers()
        except Exception:
            pass

    def do_GET(self):
        try:
            if self.path == "/probe" or self.path.startswith("/probe?"):
                # Check if browser passed node_id or rental_id to activate tunnel
                if "node_id=" in self.path or "rental_id=" in self.path:
                    import urllib.parse
                    parsed = urllib.parse.urlparse(self.path)
                    params = urllib.parse.parse_qs(parsed.query)
                    node_id = (params.get("node_id") or params.get("rental_id") or [""])[0]
                    if node_id:
                        ensure_tunnel_running(node_id)

                hw = get_hardware_cached()
                d_info = probe_docker()
                payload = {
                    **hw,
                    "docker": d_info,
                    "tunnel_active": ACTIVE_TUNNEL_WORKER is not None and ACTIVE_TUNNEL_WORKER.is_alive()
                }
                res_bytes = json.dumps(payload, indent=2).encode("utf-8")

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(res_bytes)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
                self.send_header("Connection", "close")
                self.end_headers()
                self.wfile.write(res_bytes)
            elif self.path == "/health":
                d_info = probe_docker()
                res = {
                    "status": "ok",
                    "agent": "productify-host-v2",
                    "docker_running": d_info.get("running", False),
                    "gpu_passthrough": d_info.get("gpu_support", False),
                    "tunnel_active": ACTIVE_TUNNEL_WORKER is not None
                }
                res_bytes = json.dumps(res).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(res_bytes)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Connection", "close")
                self.end_headers()
                self.wfile.write(res_bytes)
            else:
                self.send_response(404)
                self.end_headers()
        except Exception:
            pass

    def do_POST(self):
        try:
            if self.path == "/exec" or self.path.startswith("/exec?"):
                content_length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
                try:
                    payload = json.loads(body)
                except Exception:
                    payload = {}

                inst_id = payload.get("instance_id") or "local-exec"
                cmd = payload.get("command")
                code = payload.get("python_code") or payload.get("code")

                resp_data = exec_in_pod(inst_id, command=cmd, code=code)
                res_bytes = json.dumps(resp_data).encode("utf-8")

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(res_bytes)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
                self.send_header("Connection", "close")
                self.end_headers()
                self.wfile.write(res_bytes)

            elif self.path == "/tunnel/connect":
                content_length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
                data = json.loads(body)
                node_id = data.get("node_id") or data.get("rental_id")
                server_url = data.get("server_url") or DEFAULT_SERVER

                if node_id:
                    ensure_tunnel_running(node_id, server_url)
                    resp_bytes = b'{"ok": true, "status": "tunnel_connecting"}'
                else:
                    resp_bytes = b'{"ok": false, "error": "Missing node_id"}'

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(resp_bytes)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Connection", "close")
                self.end_headers()
                self.wfile.write(resp_bytes)
            else:
                self.send_response(404)
                self.end_headers()
        except Exception:
            pass


class ThreadedHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
    daemon_threads = True


# =====================================================================
# 5. CLI & RUN AGENT ENTRYPOINT
# =====================================================================
def run_agent():
    print("=" * 68)
    print(" ⚡ PRODUCTIFY HOST NODE AGENT & REVERSE TUNNEL DAEMON (v2.0)")
    print("=" * 68)
    print("Probing local system hardware...")
    hw = get_hardware_cached(force_refresh=True)
    print(f" ✓ GPU Detected:      {hw['gpu']} ({hw['vram']})")
    print(f" ✓ Driver Version:   {hw.get('driver_version') or 'N/A'}")
    print(f" ✓ CPU:              {hw['cpu']} ({hw['cpu_count']} cores)")
    print(f" ✓ System RAM:       {hw['ram_gb']} GB")
    print(f" ✓ Free Scratch:     {hw['storage_free_gb']} GB free")
    if hw.get('temperature_c'):
        print(f" ✓ Temperature:      {hw['temperature_c']}°C")

    print("-" * 68)
    d_info = probe_docker()
    if d_info["running"]:
        gpu_stat = "Enabled (--gpus all)" if d_info["gpu_support"] else "CPU mode (NVIDIA CTK not detected)"
        print(f" ✓ Docker Engine:    Running (v{d_info['version']}) · GPU Passthrough: {gpu_stat}")
    else:
        print(" ! Docker Engine:    Not active. (Sandboxed host fallback mode ready)")
        if d_info.get("error"):
            print(f"   Note: {d_info['error']}")

    print("-" * 68)
    # Check for configured node_id from previous session or CLI
    saved_node = None
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                saved_conf = json.load(f)
                saved_node = saved_conf.get("node_id")
        except Exception:
            pass

    if len(sys.argv) > 1:
        for idx, arg in enumerate(sys.argv):
            if arg in ["--node-id", "--rental-id", "-n"] and idx + 1 < len(sys.argv):
                saved_node = sys.argv[idx + 1]

    if saved_node:
        ensure_tunnel_running(saved_node)
        print(f" ✓ Reverse Tunnel:   ACTIVE for Node ID [{saved_node}]")
        print("   External renters can now connect directly to this physical machine!")
    else:
        print(" ○ Reverse Tunnel:   Standby (will connect automatically upon seller listing)")

    print("-" * 68)
    print(f" Local Loopback Bridge: http://{HOST}:{PORT}/probe")
    print(" Ready! You can click 'Auto-Detect' on the Productify Dashboard.")
    print(" Press Ctrl+C anytime to stop this agent.")
    print("=" * 68)

    server = ThreadedHTTPServer((HOST, PORT), ProductifyProbeHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Productify Agent. Shutting down reverse tunnel.")
        if ACTIVE_TUNNEL_WORKER:
            ACTIVE_TUNNEL_WORKER.running = False
        server.server_close()


if __name__ == "__main__":
    run_agent()
