#!/usr/bin/env python3
"""
Productify Host Node Agent
-------------------------
Lightweight, zero-dependency host daemon that detects your real GPU, VRAM,
CPU, RAM, and scratch disk, exposing a secure local loopback bridge on
http://127.0.0.1:48123/probe so Productify web platform can auto-detect your
actual physical machine with 1 click.

Usage:
    python scripts/productify_agent.py
    py scripts/productify_agent.py
"""

import os
import sys
import json
import time
import platform
import subprocess
import shutil
from http.server import HTTPServer, BaseHTTPRequestHandler
import socketserver

PORT = 48123
HOST = "127.0.0.1"


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

    # 1. Total System RAM
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

    # 2. Free Disk Space
    try:
        drive_path = "C:\\" if os.name == "nt" else "/"
        usage = shutil.disk_usage(drive_path)
        hw["storage_free_gb"] = round(usage.free / (1024 ** 3), 1)
    except Exception:
        hw["storage_free_gb"] = 50.0

    # 3. CPU Name Polish
    try:
        if os.name == "nt":
            cmd = ["powershell", "-NoProfile", "-Command", "(Get-CimInstance Win32_Processor).Name"]
            out = subprocess.check_output(cmd, stderr=subprocess.DEVNULL, timeout=4).decode().strip()
            if out:
                hw["cpu"] = out
    except Exception:
        pass

    # 4. NVIDIA GPU Probe via nvidia-smi
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

    # 5. Windows Fallback for GPU (if nvidia-smi not in PATH or using integrated/DirectX device)
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

    # Fallback default if completely headless / no GPU detected
    if not hw["gpu"]:
        hw["gpu"] = "Standard Compute Host"
        hw["vram"] = f"{hw['ram_gb']} GB RAM (CPU Compute)"

    return hw


class ProductifyProbeHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Clean terminal logging
        sys.stdout.write(f"[{time.strftime('%H:%M:%S')}] {args[0]} - {args[1]}\n")
        sys.stdout.flush()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        if self.path == "/probe" or self.path.startswith("/probe?"):
            data = probe_real_hardware()
            res_bytes = json.dumps(data, indent=2).encode("utf-8")

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            self.end_headers()
            self.wfile.write(res_bytes)
        elif self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b'{"status":"ok","agent":"productify-host-v1"}')
        else:
            self.send_response(404)
            self.end_headers()


class ThreadedHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
    daemon_threads = True


def run_agent():
    print("=" * 65)
    print(" ⚡ PRODUCTIFY HOST NODE AGENT")
    print("=" * 65)
    print("Probing local system hardware...")
    hw = probe_real_hardware()
    print(f" ✓ GPU Detected:    {hw['gpu']} ({hw['vram']})")
    print(f" ✓ Driver Version: {hw.get('driver_version') or 'N/A'}")
    print(f" ✓ CPU:            {hw['cpu']} ({hw['cpu_count']} cores)")
    print(f" ✓ System RAM:     {hw['ram_gb']} GB")
    print(f" ✓ Free Storage:   {hw['storage_free_gb']} GB free")
    if hw.get('temperature_c'):
        print(f" ✓ Temperature:    {hw['temperature_c']}°C")
    print("-" * 65)
    print(f" Local Loopback Bridge active at: http://{HOST}:{PORT}/probe")
    print(" Ready! You can now click 'Auto-Detect My Machine Hardware'")
    print(" on the Productify Seller Dashboard to register your real node.")
    print(" Press Ctrl+C anytime to stop this agent.")
    print("=" * 65)

    server = ThreadedHTTPServer((HOST, PORT), ProductifyProbeHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Productify Agent. Node offline.")
        server.server_close()


if __name__ == "__main__":
    run_agent()
