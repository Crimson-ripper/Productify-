"""Gamezone play sessions on rented Vast.ai VMs (2026-11-10, flow "A": rent on demand).

The player picks a region (default from their IP) and a machine near them; we rent that VM with the
kiosk setup (vast_template/gamezone_kiosk_onstart.sh), wait until it is ready, and PG Connect joins it
through the VM's WireGuard tunnel. Ending the session destroys the VM, which wipes everything the
player did on it (including their Steam/Epic login).

Everything here is blocking (Vast HTTP, SSH); the server calls it with asyncio.to_thread. All
functions are written so a warm pool can be added later: `machines_near` lists what can be used and
the server only ever asks for "a ready VM for this offer".

SSH to the VMs uses Productify's key, attached to the Vast account. The private key comes from the
environment (GZ_SSH_PRIVATE_KEY = the key text, or GZ_SSH_KEY_PATH = a file); it is never logged.
"""
import base64
import io
import logging
import os
import re
import shlex
import threading
import time
from pathlib import Path

import vast_market

from . import geo
from .vast_gaming_filter import MIN_CUDA, MIN_RELIABILITY, gpu_score

log = logging.getLogger("gamezone.play")

VM_TEMPLATE_HASH = "715c192fc2a112574ae5a9efb8c46b3b"  # Vast's official "Ubuntu Desktop (VM)"
DISK_GB = 200          # room for a few big games; the price includes it
GPU_FLOOR = 100        # RTX 3060 class or better (vast_gaming_filter.GPU_SCORE)
OLD_CPUS = ("E5-", "E3-", "X5", "E7-")  # 2014-era Xeons stutter in modern games
LIST_TTL_S = 120       # one Vast search per country every 2 minutes at most
SETUP_TIMEOUT_S = 1200
LAUNCHERS = {"steam": "Steam", "epic": "Epic Games"}  # our id -> Sunshine app name (kiosk apps.json)
WG_NET = "10.77.0"
def _packed_onstart() -> str:
    """The kiosk setup script, gzip+base64 packed behind a tiny unpacker (2026-11-22): Vast refuses
    an onstart longer than 16 KB and the script outgrew it. VMs need the shebang line."""
    import gzip
    script = (Path(__file__).parent / "vast_template" / "gamezone_kiosk_onstart.sh").read_text(encoding="utf-8")
    packed = base64.b64encode(gzip.compress(script.replace("\r\n", "\n").encode(), 9)).decode()
    return ("#!/bin/bash\n"
            f"echo '{packed}' | base64 -d | gunzip > /root/gamezone-setup.sh\n"
            "exec bash /root/gamezone-setup.sh\n")


ONSTART = _packed_onstart()
ONSTART_LIMIT = 16000  # Vast's limit is 16384; tests keep a margin

_lists, _lists_lock = {}, threading.Lock()

# Hosts that failed a session's setup (no SSH keys installed, vanished, never ready; 2026-11-22: 4
# of 6 test rentals hit one). machine_id -> unix time until which it's left out. The server loads and
# saves this in db.gz_bad_machines so it survives restarts.
BAD_MACHINES = {}
DISTANCE_COST_PER_1000_KM = 0.08  # $/h a player would pay to be 1,000 km closer (ranking only)


def is_bad(machine_id) -> bool:
    return machine_id is not None and BAD_MACHINES.get(int(machine_id), 0) > time.time()


def ping_estimate_ms(km):
    """Rough round-trip time over fibre plus routing overhead; shown to players as a guide."""
    return None if km is None else int(km / 100 * 1.5 + 10)


def value_score(row: dict) -> float:
    """Lower is better: hourly price plus a distance penalty (2026-11-21: 'nearest first' picked a
    $1.90/h machine over a $0.23/h one only a little farther away)."""
    km = row["distance_km"] if row["distance_km"] is not None else 15000
    return round(row["price"] + DISTANCE_COST_PER_1000_KM * km / 1000, 3)


# ---------------------------------------------------------------- machines near the player

def price_of(offer: dict) -> float:
    """What the player pays per hour: our real cost with the 200 GB disk, x markup, rounded up."""
    return vast_market.renter_price(vast_market.real_cost(offer, DISK_GB))


def _row(o: dict, origin) -> dict:
    pos = geo.locate(o.get("geolocation") or "")
    km = round(geo.km_between(origin, pos)) if (origin and pos) else None
    return {
        "offer_id": int(o["id"]), "gpu": vast_market.short_gpu(o.get("gpu_name") or ""),
        "vram_gb": round((o.get("gpu_ram") or 0) / 1024), "cpu": (o.get("cpu_name") or "").strip(),
        "cpu_cores": int(o.get("cpu_cores_effective") or 0), "ram_gb": round((o.get("cpu_ram") or 0) / 1024),
        "location": o.get("geolocation") or "", "country": geo.country_code(o.get("geolocation") or ""),
        "distance_km": km, "down_mbps": round(o.get("inet_down") or 0), "up_mbps": round(o.get("inet_up") or 0),
        "price": price_of(o), "score": gpu_score(o.get("gpu_name")) or 0,
        "machine_id": o.get("machine_id"), "ping_ms": ping_estimate_ms(km),
    }


def _search(countries: list) -> list:
    q = {"rentable": {"eq": True}, "rented": {"eq": False}, "type": "on-demand", "verified": {"eq": True},
         "num_gpus": {"eq": 1}, "vms_enabled": {"eq": True}, "gpu_display_active": {"eq": False},
         "reliability2": {"gte": MIN_RELIABILITY}, "cuda_max_good": {"gte": MIN_CUDA},
         "gpu_ram": {"gte": 7900}, "cpu_ram": {"gte": 15800}, "cpu_cores_effective": {"gte": 6},
         "disk_space": {"gte": DISK_GB}, "inet_down": {"gte": 300}, "inet_up": {"gte": 100},
         "order": [["dph_total", "asc"]], "limit": 200}
    if countries:
        q["geolocation"] = {"in": countries}
    offers = vast_market._request("POST", "/bundles/", q).get("offers", [])
    return [o for o in offers if (gpu_score(o.get("gpu_name")) or 0) >= GPU_FLOOR
            and not any(x in str(o.get("cpu_name")) for x in OLD_CPUS)
            and not is_bad(o.get("machine_id"))]


def machines_near(country: str, origin=None, limit: int = 12) -> dict:
    """Gaming VMs in `country`, or in the nearest countries if it has none. Best value first (price
    plus a distance penalty), then better GPU; the first one is marked recommended. Cached per
    country for LIST_TTL_S."""
    country = (country or "").upper()[:2]
    with _lists_lock:
        hit = _lists.get(country)
        if hit and time.time() - hit["at"] < LIST_TTL_S:
            return hit["data"]
    offers, used = _search([country]) if country else [], [country] if country else []
    if not offers and country in geo.COUNTRIES:
        here = geo.COUNTRIES[country]
        near = sorted((geo.km_between(here, p), c) for c, p in geo.COUNTRIES.items() if c != country)
        for n in (6, 15, 30):  # widen until something is free (2026-11-10: none within 6 of India)
            used = [c for _, c in near[:n]]
            offers = _search(used)
            if offers:
                break
    origin = origin or geo.COUNTRIES.get(country)
    rows = [_row(o, origin) for o in offers]
    for r in rows:
        r["value"] = value_score(r)
    rows.sort(key=lambda r: (r["value"], -r["score"]))
    if rows:
        rows[0]["recommended"] = True
    data = {"country": country, "searched": used, "machines": rows[:limit], "at": time.time()}
    with _lists_lock:
        _lists[country] = {"at": time.time(), "data": data}
    return data


def find_offer(offer_id: int):
    for hit in list(_lists.values()):
        for r in hit["data"]["machines"]:
            if r["offer_id"] == offer_id:
                return r
    return None


# ---------------------------------------------------------------- renting and setup

def rent(offer_id: int, label: str, resolution: str = "1920x1080") -> int:
    """Rent one kiosk VM. Every secret on it is generated on the VM (see the kiosk script)."""
    env = {"-p 1111:1111": "1", "-p 741641:741641/udp": "1", "GZ_RESOLUTION": resolution}
    body = {"template_hash_id": VM_TEMPLATE_HASH, "disk": DISK_GB, "env": env, "onstart": ONSTART, "label": label}
    res = vast_market._request("PUT", f"/asks/{int(offer_id)}/", body)
    if not res.get("success") or not res.get("new_contract"):
        raise vast_market.VastError(res.get("msg") or res.get("error") or "Vast couldn't start that machine")
    return int(res["new_contract"])


def _pkey():
    import paramiko
    text = os.environ.get("GZ_SSH_PRIVATE_KEY", "").strip()
    if not text and os.environ.get("GZ_SSH_KEY_PATH"):
        text = Path(os.environ["GZ_SSH_KEY_PATH"]).read_text()
    if not text:
        raise RuntimeError("GZ_SSH_PRIVATE_KEY is not set")
    text = _normalise_pem(text)
    for cls in (paramiko.Ed25519Key, paramiko.RSAKey, paramiko.ECDSAKey):
        try:
            return cls.from_private_key(io.StringIO(text))
        except Exception:
            continue
    raise RuntimeError("GZ_SSH_PRIVATE_KEY isn't a usable private key")


def _normalise_pem(text: str) -> str:
    """Rebuild a private key whose line breaks were lost on the way into an env var (2026-11-21:
    hosting dashboards may turn them into spaces or literal \\n). Header and footer stay; the
    base64 body is re-wrapped at 70 characters."""
    text = text.strip().strip("'\"").replace("\\r", "").replace("\\n", "\n").replace("\r", "")
    if "BEGIN" not in text:  # the whole key as one base64 line (easiest to paste)
        try:
            text = base64.b64decode(re.sub(r"\s+", "", text), validate=True).decode().strip()
        except Exception:
            pass
    m = re.search(r"(-----BEGIN [A-Z ]+-----)(.*?)(-----END [A-Z ]+-----)", text, flags=re.S)
    if not m:
        return text + "\n"
    body = re.sub(r"\s+", "", m.group(2))
    lines = [body[i:i + 70] for i in range(0, len(body), 70)]
    return "\n".join([m.group(1), *lines, m.group(3)]) + "\n"


def ssh_key_fingerprint() -> str:
    """SHA256 fingerprint of the configured key's PUBLIC half (safe to show; identifies which key it is)."""
    try:
        import hashlib
        k = _pkey()
        return "SHA256:" + base64.b64encode(hashlib.sha256(k.asbytes()).digest()).decode().rstrip("=")
    except Exception:
        return ""


def ssh_key_valid() -> bool:
    """Whether the configured key parses (for the yes/no status check; never exposes the key)."""
    try:
        _pkey()
        return True
    except Exception:
        return False


def ssh_key_configured() -> bool:
    return bool(os.environ.get("GZ_SSH_PRIVATE_KEY", "").strip() or os.environ.get("GZ_SSH_KEY_PATH"))


def run(host: str, port: int, command: str, timeout: int = 60) -> tuple:
    """(exit code, stdout) of a root command on the VM. Host keys change every rental: not checked."""
    import paramiko
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        c.connect(host, port=port, username="root", pkey=_pkey(), timeout=15, banner_timeout=20,
                  auth_timeout=20, allow_agent=False, look_for_keys=False)
        _, out, _ = c.exec_command(command, timeout=timeout)
        text = out.read().decode(errors="replace")
        return out.channel.recv_exit_status(), text.strip()
    finally:
        c.close()


def endpoints(st: dict):
    """(public ip, ssh port, wireguard udp port) from a Vast instance, or None while not known."""
    ip = (st.get("public_ipaddr") or "").strip()
    ports = st.get("ports") or {}
    ssh = (ports.get("22/tcp") or [{}])[0].get("HostPort")
    wg = None
    for k, v in ports.items():  # the identity-mapped UDP port (inside == outside)
        if k.endswith("/udp") and v and str(v[0].get("HostPort")) == k.split("/")[0]:
            wg = int(k.split("/")[0])
    if ip and ssh and wg:
        return ip, int(ssh), wg
    return None


def check_ready(host: str, ssh_port: int) -> dict:
    """Kiosk ready? Returns {"ready": bool, "host_key": wg public key, "detail": last setup line}."""
    rc, out = run(host, ssh_port,
                  "if test -f /var/lib/gamezone-ready && systemctl is-active -q wg-quick@wg0 && pgrep -x sunshine >/dev/null; "
                  "then echo READY; cat /etc/wireguard/host.pub; else echo WAIT; tail -1 /var/log/gamezone-setup.log; fi", 40)
    lines = out.splitlines()
    if rc == 0 and lines and lines[0] == "READY" and len(lines) > 1:
        return {"ready": True, "host_key": lines[1].strip(), "detail": ""}
    detail = (lines[-1] if len(lines) > 1 else "").replace("[gamezone]", "").strip()
    return {"ready": False, "host_key": "", "detail": detail[:160]}


WG_KEY_RE = re.compile(r"[A-Za-z0-9+/]{43}=")


def add_peer(host: str, ssh_port: int, client_key: str) -> None:
    if not WG_KEY_RE.fullmatch(client_key or ""):
        raise ValueError("invalid WireGuard key")
    rc, out = run(host, ssh_port, f"/usr/local/sbin/gamezone-wg-peer add {shlex.quote(client_key)} && {SUNSHINE_UNPAIR} && {SUNSHINE_HEAL}", 60)
    if rc != 0:
        raise RuntimeError(f"peer add failed: {out[-160:]}")
    if "sunshine-restarted" in out:
        log.warning(f"{host}: Sunshine's HTTPS port was hung; restarted it before the join")


# 2026-11-21: after an abandoned pairing attempt, Sunshine's HTTPS port (47984) can stop answering
# while HTTP still works, so every later pairing times out. Without a client certificate a healthy
# port refuses the TLS handshake at once (curl exits non-zero quickly); a hung one times out (28).
# On a timeout, restart Sunshine inside the kiosk user's X session before PG Connect pairs.
# 2026-11-27: PG Connect pairs again on every join with the same client certificate, and Sunshine
# 2026.914+ refuses a certificate that matches more than one saved pairing ("Client certificate
# identity is not enabled"), so the second join to a reused machine always failed. One player per
# machine: forget earlier pairings before this join pairs.
SUNSHINE_UNPAIR = ("(set -a; . /root/gamezone-secrets; curl -sk -m 5 -o /dev/null -u \"$SUNSHINE_USER:$SUNSHINE_PASS\" "
                   "-X POST https://localhost:47990/api/clients/unpair-all; true)")


# The E2E image runs the kiosk (X + Sunshine) as the systemd unit gamezone-kiosk: restart that instead.
SUNSHINE_HEAL = (
    "curl -sk -m 4 -o /dev/null https://localhost:47984/serverinfo; rc=$?; "
    "if [ $rc -eq 28 ] && systemctl -q is-enabled gamezone-kiosk 2>/dev/null; then "
    "systemctl restart gamezone-kiosk; sleep 10; echo sunshine-restarted; "
    "elif [ $rc -eq 28 ]; then pkill -x sunshine; sleep 2; U=$(id -u player); "
    "sudo -u player env DISPLAY=:0 HOME=/home/player XDG_RUNTIME_DIR=/run/user/$U "
    "sh -c 'nohup /usr/bin/sunshine > /tmp/sunshine.log 2>&1 &'; sleep 6; echo sunshine-restarted; fi; true"
)


def submit_pin(host: str, ssh_port: int, pin: str, device_name: str) -> bool:
    """Send the pairing PIN to Sunshine on the VM (its credentials never leave the VM). Sunshine only
    accepts it while PG Connect's pairing request is waiting, so retry for ~20 s."""
    if not re.fullmatch(r"\d{4}", pin or ""):
        return False
    name = re.sub(r"[^A-Za-z0-9 _-]", "", device_name or "PG Connect")[:40] or "PG Connect"
    # Sunshine's /api/pin answers {"status":true} even when no pairing request is waiting, and then the
    # PIN is lost or used by the next attempt ("PIN didn't match", 2026-11-10). So submit once, only after
    # PG Connect's pairing request (a held-open HTTP call to port 47989 from the tunnel) has arrived.
    # Seen twice 0.5 s apart, so a short status request (serverinfo) on the same port doesn't count.
    # Newer Sunshine (2026.914+, the E2E image) also wants the waiting request's pairing_id, read from
    # GET /api/pin; older Sunshine has no such list, so the id stays empty and the old body is sent.
    find_id = ("python3 -c 'import sys,json\ntry: d=json.load(sys.stdin)\nexcept Exception: d={}\n"
               f"print(next((p.get(\"id\",\"\") for p in d.get(\"pairings\") or [] if p.get(\"address\")==\"{WG_NET}.2\"),\"\"))'")
    cmd = (f"hits=0; for i in $(seq 1 60); do "
           f"if ss -Htn state established '( sport = :47989 )' | grep -q '{WG_NET}.2:'; then hits=$((hits+1)); else hits=0; fi; "
           "[ $hits -ge 2 ] && break; sleep 0.5; done; "
           "set -a; . /root/gamezone-secrets; A=\"$SUNSHINE_USER:$SUNSHINE_PASS\"; "
           f"ID=$(curl -sk -m 5 -u \"$A\" https://localhost:47990/api/pin 2>/dev/null | {find_id} 2>/dev/null); "
           f"if [ -n \"$ID\" ]; then BODY='{{\"pairing_id\":\"'\"$ID\"'\",\"pin\":\"{pin}\",\"name\":\"{name}\"}}'; "
           f"else BODY='{{\"pin\":\"{pin}\",\"name\":\"{name}\"}}'; fi; "
           "curl -sk -u \"$A\" -H 'Content-Type: application/json' -d \"$BODY\" https://localhost:47990/api/pin")
    try:
        _, out = run(host, ssh_port, cmd, 45)
    except Exception as e:
        log.warning(f"pin submit: {e}")
        return False
    ok = '"status":true' in out.replace(" ", "") or '"status":"true"' in out.replace(" ", "")
    if not ok:
        log.warning(f"pin submit: Sunshine answered {out[:120]!r}")
    return ok


# What a session leaves behind for diagnosing crashes (2026-11-22): watchdog decisions, Sunshine
# errors and client disconnects, kernel crash/out-of-memory/GPU messages, Steam/Proton crash lines.
# No game data, no store logins. Capped so one session can't store much.
DIAG_CMD = r"""
echo '== watchdog'; tail -40 /tmp/gamezone-watchdog.log 2>/dev/null
echo '== sunshine'; grep -aE 'Error|Fatal|CLIENT (DIS)?CONNECTED|Spawning|exited' /tmp/sunshine.log 2>/dev/null | grep -v 'SSL Verification' | tail -40
echo '== kernel'; dmesg 2>/dev/null | grep -iE 'segfault|out of memory|oom|killed process|xid|nvrm.*error' | tail -20
echo '== steam'; grep -ahiE 'crash|segfault|fatal|assert|minidump|Game process removed|Game process added' \
  /home/player/.steam/steam/logs/console_log.txt /home/player/.steam/steam/logs/content_log.txt 2>/dev/null | tail -40
echo '== memory'; free -m | head -2
"""


def collect_diagnostics(host: str, ssh_port: int) -> dict:
    rc, out = run(host, ssh_port, DIAG_CMD, 30)
    return {"collected_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "text": out[-20000:]}


def player_connected(host: str, ssh_port: int, within: int = 180):
    """True if PG Connect's tunnel had a WireGuard handshake in the last `within` seconds (it keeps
    the tunnel alive every 25 s, which renews the handshake about every 2 minutes), False if not,
    None if the VM couldn't be asked. Times are compared on the VM, so clock drift doesn't matter."""
    try:
        rc, out = run(host, ssh_port, "date +%s; wg show wg0 latest-handshakes", 20)
    except Exception:
        return None
    lines = out.split()
    if rc != 0 or not lines or not lines[0].isdigit():
        return None
    now, stamps = int(lines[0]), [int(x) for x in lines[2::2] if x.isdigit()]
    return any(t and now - t <= within for t in stamps)


def tunnel(host: str, wg_port: int, host_key: str) -> dict:
    """The `network` block PG Connect expects (productify-connect DESIGN.md)."""
    return {"mode": "wireguard", "wireguard": {
        "interface_address": f"{WG_NET}.2/32", "peer_public_key": host_key, "endpoint": f"{host}:{wg_port}",
        "allowed_ips": f"{WG_NET}.1/32", "host_tunnel_address": f"{WG_NET}.1", "mtu": 1280,
        "persistent_keepalive": 25}}
