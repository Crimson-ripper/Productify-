"""Gamezone live inventory: machines from every provider in one shape, refreshed in the background.

Users never query providers directly. A collector refreshes each provider into an in-memory
snapshot; the API reads only from the snapshot. A provider whose snapshot is older than
STALE_AFTER_S is left out entirely, so the site never shows machines we can't vouch for
(CLAUDE.md rule 3.1). Prices are deliberately not exposed yet (pricing not decided).

Common machine fields: id, provider, gpu_model, gpu_count, gpu_vram_gb, gpu_cores, cpu_model,
cpu_cores, ram_gb, disk_gb, location, country, lat, lon, kind, verified, streaming_ok.
"""
import asyncio
import logging
import re
import time
from collections import defaultdict

from . import geo
from .vast_api import VastError, env_setting, search_offers

log = logging.getLogger("gamezone.inventory")

STALE_AFTER_S = 300          # hide a provider's machines when its data is older than 5 minutes
REFRESH_S = {"vast": 120, "node": 30}
VAST_QUERY_LIMIT = 1000

# CUDA core counts for common cards (providers rarely report them).
GPU_CORES = {
    "RTX 3060": 3584, "RTX 3060 TI": 4864, "RTX 3070": 5888, "RTX 3070 TI": 6144, "RTX 3080": 8704,
    "RTX 3080 TI": 10240, "RTX 3090": 10496, "RTX 3090 TI": 10752, "RTX 4060": 3072, "RTX 4060 TI": 4352,
    "RTX 4070": 5888, "RTX 4070 SUPER": 7168, "RTX 4070 TI": 7680, "RTX 4070 TI SUPER": 8448,
    "RTX 4080": 9728, "RTX 4080 SUPER": 10240, "RTX 4090": 16384, "RTX 5060 TI": 4608, "RTX 5070": 6144,
    "RTX 5070 TI": 8960, "RTX 5080": 10752, "RTX 5090": 21760, "RTX A4000": 6144, "RTX A5000": 8192,
    "RTX A6000": 10752, "RTX 4070S": 7168, "RTX 4070S TI": 8448, "RTX 4080S": 10240, "RTX 6000ADA": 18176, "RTX 4000ADA": 6144, "L4": 7424, "L40": 18176,
    "L40S": 18176, "A10": 9216, "A40": 10752, "T4": 2560, "GTX 1080 TI": 3584, "GTX 1080": 2560,
}

_NON_STREAMING = ("A100", "H100", "H200", "B200", "B300", "CMP", "V100", "A30", "MI3")
_STREAMING_DC = ("T4", "L4", "A10", "A16", "A40", "L40", "L40S")


def short_model(name: str) -> str:
    """'NVIDIA GeForce RTX 4090' -> 'RTX 4090' (Vast already sends 'RTX 4090')."""
    s = re.sub(r"^(NVIDIA\s+)?(GEFORCE\s+)?", "", (name or "").strip(), flags=re.I)
    return re.sub(r"\s+", " ", s).strip()


def streaming_ok(model: str, vram_gb: float) -> bool:
    """Cards with NVENC + graphics support and enough VRAM for games."""
    m = (model or "").upper()
    if any(t in m for t in _NON_STREAMING):
        return False
    tokens = re.split(r"[^A-Z0-9]+", m)
    return (any(t in m for t in ("RTX", "GTX", "TITAN")) or any(t in tokens for t in _STREAMING_DC)) and (vram_gb or 0) >= 6


def _with_place(row: dict) -> dict:
    pos = geo.locate(row.get("location", ""))
    row["country"] = geo.country_code(row.get("location", ""))
    row["lat"], row["lon"] = (pos if pos else (None, None))
    row["gpu_cores"] = GPU_CORES.get((row.get("gpu_model") or "").upper())
    row["streaming_ok"] = streaming_ok(row.get("gpu_model"), row.get("gpu_vram_gb"))
    return row


# ---------------------------------------------------------------- adapters

def vast_machines(api_key: str) -> list:
    """Rentable, verified, not-rented Vast.ai machines (one row per machine)."""
    offers = search_offers(api_key, {
        "rentable": {"eq": True}, "rented": {"eq": False}, "verified": {"eq": True},
        "type": "on-demand", "limit": VAST_QUERY_LIMIT,
    })
    best = {}
    for x in offers:  # Vast lists several offers per machine (1, 2, 4 GPUs); keep the largest
        mid = x.get("machine_id")
        if mid is not None and (mid not in best or (x.get("num_gpus") or 0) > (best[mid].get("num_gpus") or 0)):
            best[mid] = x
    rows = []
    for mid, x in best.items():
        rows.append(_with_place({
            "id": f"vast-{mid}",
            "provider": "vast",
            "gpu_model": short_model(x.get("gpu_name")),
            "gpu_count": int(x.get("num_gpus") or 1),
            "gpu_vram_gb": round((x.get("gpu_ram") or 0) / 1024),
            "cpu_model": (x.get("cpu_name") or "").strip() or None,
            "cpu_cores": int(x["cpu_cores_effective"]) if x.get("cpu_cores_effective") else None,
            "ram_gb": round((x.get("cpu_ram") or 0) / 1024) or None,
            "disk_gb": round(x.get("disk_space") or 0) or None,
            "location": x.get("geolocation") or "",
            "kind": "vm" if x.get("vms_enabled") else "container",
            "verified": True,
            "upload_mbps": round(x.get("inet_up") or 0),
        }))
    return rows


def _gb(mb):
    return round(mb / 1024) if isinstance(mb, (int, float)) and mb > 0 else None


def node_machines(rentals: list, meta: dict) -> list:
    """Productify Node listings that are approved, connected and free right now.

    `rentals` are rows from db.rentals already passed through add_availability();
    `meta` is node_hub.meta (what each paired agent reported in its hello frame)."""
    rows = []
    for r in rentals:
        if r.get("status") != "approved" or r.get("availability") != "available":
            continue
        m = meta.get(r.get("id")) or {}
        gpu = short_model(m.get("gpu") or r.get("gpu"))
        if not gpu or gpu.lower().startswith("cpu only"):
            continue
        specs = r.get("specs") or {}
        vram = _gb(m.get("vram_mb"))
        if vram is None:
            num = re.search(r"\d+", str(r.get("vram") or ""))
            vram = int(num.group()) if num else None
        rows.append(_with_place({
            "id": f"node-{r['id']}",
            "provider": "productify",
            "gpu_model": gpu,
            "gpu_count": 1,
            "gpu_vram_gb": vram,
            "cpu_model": (m.get("cpu") or specs.get("cpu_model") or "").strip() or None,
            "cpu_cores": int(m["cpu_cores"]) if isinstance(m.get("cpu_cores"), (int, float)) else None,
            "ram_gb": _gb(m.get("ram_mb")),
            "disk_gb": None,
            "location": r.get("location") or "",
            "kind": "container",
            "verified": bool(r.get("is_verified")),
            "upload_mbps": None,
        }))
    return rows


# ---------------------------------------------------------------- store

class InventoryStore:
    """Latest machines per provider, with the time each snapshot was taken."""

    def __init__(self):
        self.snapshots = {}   # provider -> (fetched_at, rows)
        self.errors = {}      # provider -> last error text

    def put(self, provider: str, rows: list, now: float = None):
        self.snapshots[provider] = (now if now is not None else time.time(), rows)
        self.errors.pop(provider, None)

    def fail(self, provider: str, error: str):
        self.errors[provider] = error[:200]  # keep the previous snapshot until it goes stale

    def machines(self, now: float = None) -> list:
        now = now if now is not None else time.time()
        out = []
        for fetched_at, rows in self.snapshots.values():
            if now - fetched_at <= STALE_AFTER_S:
                out.extend(rows)
        return out

    def status(self, now: float = None) -> dict:
        now = now if now is not None else time.time()
        return {p: {"age_s": round(now - t), "machines": len(rows), "fresh": now - t <= STALE_AFTER_S,
                    "error": self.errors.get(p)} for p, (t, rows) in self.snapshots.items()} | {
            p: {"age_s": None, "machines": 0, "fresh": False, "error": e}
            for p, e in self.errors.items() if p not in self.snapshots}


store = InventoryStore()


async def collector_loop(load_node_rows):
    """Refresh each provider on its own schedule. `load_node_rows` is an async callable returning
    (rentals_with_availability, node_meta) from server.py, so this module stays DB-agnostic."""
    next_due = defaultdict(float)
    while True:
        now = time.time()
        if now >= next_due["node"]:
            next_due["node"] = now + REFRESH_S["node"]
            try:
                rentals, meta = await load_node_rows()
                store.put("productify", node_machines(rentals, meta))
            except Exception as e:  # one provider failing never stops the others
                store.fail("productify", str(e))
                log.warning(f"inventory: productify refresh failed: {e}")
        if now >= next_due["vast"]:
            next_due["vast"] = now + REFRESH_S["vast"]
            key = env_setting("VAST_API_KEY")
            if key:
                try:
                    store.put("vast", await asyncio.to_thread(vast_machines, key))
                except (VastError, Exception) as e:
                    store.fail("vast", str(e))
                    log.warning(f"inventory: vast refresh failed: {e}")
        await asyncio.sleep(5)


# ---------------------------------------------------------------- queries

def with_distance(rows: list, origin) -> list:
    """Copy rows adding distance_km from origin (lat, lon); unknown places sort last."""
    out = []
    for r in rows:
        d = None
        if origin and r.get("lat") is not None:
            d = round(geo.km_between(origin, (r["lat"], r["lon"])))
        out.append({**r, "distance_km": d})
    return out


def _sort_key(r):
    return (r["distance_km"] is None, r["distance_km"] if r["distance_km"] is not None else 0)


def public(r: dict) -> dict:
    """What the website may see: no provider offer IDs, no exact coordinates."""
    return {k: v for k, v in r.items() if k not in ("lat", "lon")}


def group_by_gpu(rows: list, origin=None, min_vram_gb: float = 0, streaming_only: bool = True) -> list:
    """One entry per GPU model: how many free machines, the nearest one, and which is recommended.

    Output is sorted nearest-first; the nearest group that meets min_vram_gb is marked recommended."""
    rows = with_distance(rows, origin)
    groups = defaultdict(list)
    for r in rows:
        if streaming_only and not r.get("streaming_ok"):
            continue
        groups[r["gpu_model"]].append(r)
    out = []
    for model, items in groups.items():
        items.sort(key=_sort_key)
        near = items[0]
        out.append({
            "gpu_model": model,
            "available": len(items),
            "gpu_vram_gb": max((i.get("gpu_vram_gb") or 0) for i in items) or None,
            "gpu_cores": near.get("gpu_cores"),
            "nearest_km": near["distance_km"],
            "nearest_location": near.get("location"),
            "providers": sorted({i["provider"] for i in items}),
            "meets_minimum": (max((i.get("gpu_vram_gb") or 0) for i in items)) >= (min_vram_gb or 0),
            "recommended": False,
        })
    out.sort(key=lambda g: (not g["meets_minimum"], g["nearest_km"] is None, g["nearest_km"] or 0, -g["available"]))
    for g in out:
        if g["meets_minimum"]:
            g["recommended"] = True
            break
    return out


def search(rows: list, origin=None, *, gpu_model: str = "", min_vram_gb: float = 0, min_ram_gb: float = 0,
           min_cpu_cores: int = 0, cpu_model: str = "", min_gpu_cores: int = 0, max_km: float = 0,
           provider: str = "", streaming_only: bool = False, limit: int = 100) -> list:
    """Machine/GPU search with filters, nearest first."""
    gm, cm = gpu_model.strip().lower(), cpu_model.strip().lower()
    hits = []
    for r in with_distance(rows, origin):
        if gm and gm not in (r.get("gpu_model") or "").lower():
            continue
        if cm and cm not in (r.get("cpu_model") or "").lower():
            continue
        if min_vram_gb and (r.get("gpu_vram_gb") or 0) < min_vram_gb:
            continue
        if min_ram_gb and (r.get("ram_gb") or 0) < min_ram_gb:
            continue
        if min_cpu_cores and (r.get("cpu_cores") or 0) < min_cpu_cores:
            continue
        if min_gpu_cores and (r.get("gpu_cores") or 0) < min_gpu_cores:
            continue
        if max_km and (r["distance_km"] is None or r["distance_km"] > max_km):
            continue
        if provider and r.get("provider") != provider:
            continue
        if streaming_only and not r.get("streaming_ok"):
            continue
        hits.append(r)
    hits.sort(key=_sort_key)
    return [public(r) for r in hits[:max(1, min(limit, 500))]]
