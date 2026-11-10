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
ONSTART = (Path(__file__).parent / "vast_template" / "gamezone_kiosk_onstart.sh").read_text(encoding="utf-8")

_lists, _lists_lock = {}, threading.Lock()


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
            and not any(x in str(o.get("cpu_name")) for x in OLD_CPUS)]


def machines_near(country: str, origin=None, limit: int = 12) -> dict:
    """Gaming VMs in `country`, or in the nearest countries if it has none. Nearest first, then
    better GPU, then cheaper. Cached per country for LIST_TTL_S."""
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
    rows.sort(key=lambda r: (r["distance_km"] if r["distance_km"] is not None else 1e9, -r["score"], r["price"]))
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
    text = text.replace("\\n", "\n")
    for cls in (paramiko.Ed25519Key, paramiko.RSAKey, paramiko.ECDSAKey):
        try:
            return cls.from_private_key(io.StringIO(text + "\n"))
        except Exception:
            continue
    raise RuntimeError("GZ_SSH_PRIVATE_KEY isn't a usable private key")


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
    rc, out = run(host, ssh_port, f"/usr/local/sbin/gamezone-wg-peer add {shlex.quote(client_key)}", 40)
    if rc != 0:
        raise RuntimeError(f"peer add failed: {out[-160:]}")


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
    cmd = (f"hits=0; for i in $(seq 1 60); do "
           f"if ss -Htn state established '( sport = :47989 )' | grep -q '{WG_NET}.2:'; then hits=$((hits+1)); else hits=0; fi; "
           "[ $hits -ge 2 ] && break; sleep 0.5; done; "
           "set -a; . /root/gamezone-secrets; curl -sk -u \"$SUNSHINE_USER:$SUNSHINE_PASS\" "
           "-H 'Content-Type: application/json' "
           f"-d '{{\"pin\":\"{pin}\",\"name\":\"{name}\"}}' https://localhost:47990/api/pin")
    try:
        _, out = run(host, ssh_port, cmd, 45)
    except Exception as e:
        log.warning(f"pin submit: {e}")
        return False
    ok = '"status":true' in out.replace(" ", "") or '"status":"true"' in out.replace(" ", "")
    if not ok:
        log.warning(f"pin submit: Sunshine answered {out[:120]!r}")
    return ok


def tunnel(host: str, wg_port: int, host_key: str) -> dict:
    """The `network` block PG Connect expects (productify-connect DESIGN.md)."""
    return {"mode": "wireguard", "wireguard": {
        "interface_address": f"{WG_NET}.2/32", "peer_public_key": host_key, "endpoint": f"{host}:{wg_port}",
        "allowed_ips": f"{WG_NET}.1/32", "host_tunnel_address": f"{WG_NET}.1", "mtu": 1280,
        "persistent_keepalive": 25}}
