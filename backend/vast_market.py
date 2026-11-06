"""Vast.ai partner machines for the GPU rentals page.

Productify rents Vast.ai machines on its own account and bills renters in Productify credits
(permission from Vast: phone call, 2026-11-02 — written confirmation requested).

- OfferCache keeps a short, curated list of rentable machines, refreshed every few minutes.
  Renters never call Vast directly; the site reads only the cache.
- Only verified, reliable machines with enough VRAM, disk and bandwidth are shown, and only the
  cheapest few of each GPU model, so the page stays readable.
- Renter price = Vast cost with our disk size x VAST_MARKUP (env), rounded up to the next cent.
  User decision 2026-11-05: 105% markup (45-55% base + 10-20% data transfer + 18-30% tax), so the
  multiplier is never below 2.05.
"""
import asyncio
import json
import logging
import math
import os
import re
import time
import urllib.error
import urllib.request

log = logging.getLogger("vast_market")

API = "https://console.vast.ai/api/v0"
# Vast allows 20,000 search rows a day: 300 rows every 30 minutes is 14,400, leaving room for restarts.
REFRESH_S = 1800
STALE_S = 5400
OFFER_LIMIT = 300
PER_MODEL = 3
MIN = {"gpu_ram_gb": 8, "reliability": 0.97, "inet_down": 200, "inet_up": 100, "disk_space": 60, "cuda": 12.0}
NOT_FOR_RENTERS = ("CMP",)  # mining cards


def _key() -> str:
    return os.environ.get("VAST_API_KEY", "").strip()


MIN_MARKUP = 2.05  # user: 105% markup
RENTED_DISK_GB = 40  # every partner rental's disk; Vast's list price assumes a smaller one


def markup() -> float:
    try:
        return max(MIN_MARKUP, float(os.environ.get("VAST_MARKUP", str(MIN_MARKUP))))
    except ValueError:
        return MIN_MARKUP


def renter_price(cost: float) -> float:
    """Vast $/hour to renter $/hour, rounded up so the markup is never cut short."""
    return math.ceil(round(cost * markup() * 100, 6)) / 100


def real_cost(offer: dict, disk_gb: int = RENTED_DISK_GB) -> float:
    """$/hour for this offer with our disk. storage_cost is $/GB/month (720 hours)."""
    base, storage = offer.get("dph_base"), offer.get("storage_cost")
    if base is None or storage is None:
        return float(offer.get("dph_total") or 0)
    return float(base) + float(storage) * disk_gb / 720


class VastError(RuntimeError):
    pass


def _request(method: str, path: str, body=None, timeout: int = 60):
    key = _key()
    if not key:
        raise VastError("VAST_API_KEY isn't set")
    req = urllib.request.Request(f"{API}{path}", data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                                 method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
    except urllib.error.HTTPError as e:
        raise VastError(f"{method} {path.split('?')[0]} -> HTTP {e.code}: {e.read().decode(errors='replace')[:300]}") from None
    except urllib.error.URLError as e:
        raise VastError(f"couldn't reach Vast: {e.reason}") from None
    return json.loads(raw) if raw else {}


def short_gpu(name: str) -> str:
    return (name or "").replace("NVIDIA ", "").replace("GeForce ", "").strip()


def valid_rows(offers: list) -> list:
    """Every good machine, as Productify listings (dicts shaped like rentals), cheapest first."""
    ok = []
    for o in offers:
        gpu = short_gpu(o.get("gpu_name"))
        vram = (o.get("gpu_ram") or 0) / 1024
        if any(t in gpu.upper() for t in NOT_FOR_RENTERS):
            continue
        if (vram < MIN["gpu_ram_gb"] or (o.get("reliability2") or o.get("reliability") or 0) < MIN["reliability"]
                or (o.get("inet_down") or 0) < MIN["inet_down"] or (o.get("inet_up") or 0) < MIN["inet_up"]
                or (o.get("disk_space") or 0) < MIN["disk_space"] or (o.get("cuda_max_good") or 0) < MIN["cuda"]
                or o.get("verification") not in ("verified", None) and not o.get("verified")):
            continue
        n = int(o.get("num_gpus") or 1)
        if n != 1:  # one GPU per rental, like Productify Node machines
            continue
        cost = real_cost(o)
        price = renter_price(cost)
        if price <= 0:
            continue
        geo = o.get("geolocation") or ""
        ok.append({
            "id": f"vast-{o['id']}",
            "offer_id": int(o["id"]),
            "provider": "vast",
            "title": f"{gpu} · partner machine",
            "gpu": gpu,
            "vram": f"{round(vram)} GB",
            "location": geo,
            "price": price,
            "cost": round(cost, 4),
            "specs": {"cpu": f"{int(o.get('cpu_cores_effective') or 0)} cores", "cpu_model": (o.get("cpu_name") or "").strip(),
                      "ram": f"{round((o.get('cpu_ram') or 0) / 1024)} GB", "disk": f"{round(o.get('disk_space') or 0)} GB",
                      "internet": f"{round(o.get('inet_down') or 0)} / {round(o.get('inet_up') or 0)} Mbps"},
            "status": "approved",
            "availability": "available",
            "is_online": True,
            "is_verified": True,
            "owner": "Vast.ai partner",
            "partner": True,
            "vram_gb": round(vram),
            "direct_ports": int(o.get("direct_port_count") or 0),
            "direct_ports": int(o.get("direct_port_count") or 0),
            "reliability": float(o.get("reliability2") or o.get("reliability") or 0),
        })
    ok.sort(key=lambda r: (r["gpu"], r["price"]))
    return ok


def curate(offers: list, now: float = None) -> list:
    """The cheapest few of each GPU model, for a readable list."""
    ok = valid_rows(offers)
    out, per = [], {}
    for r in ok:
        per[r["gpu"]] = per.get(r["gpu"], 0) + 1
        if per[r["gpu"]] <= PER_MODEL:
            out.append(r)
    return out


class OfferCache:
    def __init__(self):
        self.rows, self.pool, self.at, self.error = [], [], 0.0, ""

    def fresh_pool(self, now: float = None) -> list:
        now = now if now is not None else time.time()
        return self.pool if now - self.at <= STALE_S else []

    def fresh(self, now: float = None) -> list:
        now = now if now is not None else time.time()
        return self.rows if now - self.at <= STALE_S else []

    def get(self, rid: str):
        return next((r for r in self.fresh() if r["id"] == rid), None)

    def refresh_once(self):
        offers = _request("POST", "/bundles/", {"rentable": {"eq": True}, "rented": {"eq": False}, "verified": {"eq": True},
                                                "type": "on-demand", "num_gpus": {"eq": 1}, "limit": OFFER_LIMIT}).get("offers", [])
        pool = valid_rows(offers)
        self.pool, self.rows, self.at, self.error = pool, curate(offers), time.time(), ""

    async def loop(self):
        while True:
            wait = REFRESH_S
            if _key():
                try:
                    await asyncio.to_thread(self.refresh_once)
                except Exception as e:
                    self.error = str(e)[:200]
                    log.warning(f"vast offers refresh failed: {e}")
                    # Out of quota: retrying only wastes requests, so wait as long as Vast asks.
                    m = re.search(r'"retry_after":\s*(\d+)', str(e))
                    if m:
                        wait = max(REFRESH_S, int(m.group(1)) + 60)
            await asyncio.sleep(wait)


cache = OfferCache()


def rent(offer_id: int, image: str, disk_gb: int, env: dict, onstart: str, label: str) -> int:
    """Create an instance on Productify's Vast account; returns the Vast instance id."""
    # "ssh" run mode is what makes Vast run our onstart script; "args" mode fails to start the
    # container on hosts (tested 2026-11-03: 6/6 failed with args, ssh started in ~70 s).
    body = {"image": image, "disk": disk_gb, "env": env, "onstart": onstart, "label": label, "runtype": "ssh"}
    res = _request("PUT", f"/asks/{int(offer_id)}/", body)
    if not res.get("success") or not res.get("new_contract"):
        raise VastError(res.get("msg") or res.get("error") or "Vast couldn't start that machine")
    return int(res["new_contract"])


def destroy(instance_id: int) -> None:
    _request("DELETE", f"/instances/{int(instance_id)}/")


def status(instance_id: int) -> dict:
    return _request("GET", f"/instances/{int(instance_id)}/").get("instances") or {}


def list_ours() -> list:
    """Productify's Vast instances (label starts with 'pfy-')."""
    rows, token = [], None
    while True:
        path = "/v1/instances/" + (f"?next_token={token}" if token else "")
        req_api = API.replace("/api/v0", "/api")
        key = _key()
        r = urllib.request.Request(f"{req_api}{path}", headers={"Authorization": f"Bearer {key}"})
        with urllib.request.urlopen(r, timeout=60) as resp:
            res = json.loads(resp.read() or b"{}")
        rows += [i for i in res.get("instances", []) if str(i.get("label") or "").startswith("pfy-")]
        token = res.get("next_token")
        if not token:
            return rows


# ---------- GPU on demand: order by requirements ----------
# Partner GPUs get rented by others within minutes, so renters don't pick a specific Vast machine.
# They pick a class; we show a live price range, they set a price cap, and we rent the best match.
CLASSES = [
    {"id": "entry", "name": "Entry", "vram": "8-12 GB", "min_vram": 8, "max_vram": 12, "pro": False,
     "examples": "RTX 3060, 3070, 3080", "for": "Learning, small models, inference"},
    {"id": "mid", "name": "Mid", "vram": "16-24 GB", "min_vram": 16, "max_vram": 24, "pro": False,
     "examples": "RTX 3090, 4080, 5070 Ti", "for": "Fine-tuning, image generation, 7B-13B models"},
    {"id": "high", "name": "High", "vram": "24-32 GB, latest cards", "min_vram": 24, "max_vram": 32, "pro": False,
     "examples": "RTX 4090, 5090", "for": "Fastest consumer GPUs, larger models"},
    {"id": "datacenter", "name": "Data-centre", "vram": "40-80 GB+", "min_vram": 40, "max_vram": 999, "pro": True,
     "examples": "A100, H100, L40S", "for": "Big training runs, large models"},
]
DATACENTER = ("A100", "H100", "H200", "B200", "L40", "A40", "A6000", "6000ADA", "PRO 6000")
LATEST = ("4090", "5090")


def in_class(row: dict, cls: dict) -> bool:
    g = row["gpu"].upper().replace(" ", "")
    v = row.get("vram_gb") or 0
    is_dc = any(t.replace(" ", "") in g for t in DATACENTER)
    if cls["pro"]:
        return is_dc and v >= cls["min_vram"]
    if is_dc:
        return False
    if cls["id"] == "high":
        return any(t in g for t in LATEST)
    if cls["id"] == "mid":
        return cls["min_vram"] <= v <= cls["max_vram"] and not any(t in g for t in LATEST)
    return cls["min_vram"] <= v <= cls["max_vram"]


def get_class(class_id: str):
    return next((c for c in CLASSES if c["id"] == class_id), None)


def _pct(vals, q):
    vals = sorted(vals)
    return vals[min(len(vals) - 1, max(0, int(round(q * (len(vals) - 1)))))]


def class_summary(pool: list) -> list:
    """Live price range per class (renter prices): low = 10th percentile, typical = median,
    high = 80th percentile. 'available' is how many machines match right now."""
    out = []
    for c in CLASSES:
        prices = [r["price"] for r in pool if in_class(r, c)]
        item = {k: c[k] for k in ("id", "name", "vram", "examples", "for")}
        item["available"] = len(prices)
        if prices:
            item.update(low=_pct(prices, 0.1), typical=_pct(prices, 0.5), high=_pct(prices, 0.8))
        out.append(item)
    return out


def candidates(pool: list, class_id: str, max_price: float, origin=None, distance=None, near: bool = True) -> list:
    """Machines to try for an order, best first: within the cap, reliable, near the renter if asked."""
    cls = get_class(class_id)
    if not cls:
        return []
    rows = [r for r in pool if in_class(r, cls) and r["price"] <= max_price + 1e-9]

    def key(r):
        d = distance(r) if (near and origin is not None and distance) else None
        bucket = 0 if d is None else (0 if d < 2500 else 1 if d < 6000 else 2)
        return (bucket, -round(r.get("reliability", 0), 2), r["price"])
    return sorted(rows, key=key)
