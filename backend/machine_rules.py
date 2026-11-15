"""What a host machine can be rented for, and the GPU names the admin price table uses (2026-11-15).

Hosts don't set prices: Productify admins keep a price per GPU model (db.gpu_prices) and can override
it per machine. Each use (AI / basic Python / Gamezone) has minimum hardware; a machine is offered
only for the uses it meets, and can't be listed if it meets none.

Numbers come from what Productify Node reports (GPU, VRAM, RAM, CPU cores). Free disk and upload
speed aren't reported yet, so they aren't checked yet (listed in each use's `later` for the UI).
"""
import re

from gamezone.vast_gaming_filter import gpu_score

USES = {
    "ai": {
        "name": "AI / Jupyter (PyTorch)", "templates": ["jupyter-pytorch"],
        "min_vram_gb": 8, "min_ram_gb": 16, "min_cpu_cores": 4, "later": ["100 GB free disk"],
    },
    "basic": {
        "name": "Basic Python", "templates": ["ubuntu-base"],
        "min_vram_gb": 6, "min_ram_gb": 8, "min_cpu_cores": 4, "later": ["50 GB free disk"],
    },
    "gamezone": {
        "name": "Gamezone", "templates": [],
        "min_vram_gb": 8, "min_ram_gb": 16, "min_cpu_cores": 6, "min_gpu_score": 100,  # RTX 3060 class
        "needs_gamezone_eligible": True, "later": ["150 GB free disk", "fast upload"],
    },
}


def short_gpu(name: str) -> str:
    """'NVIDIA GeForce RTX 3060' -> 'RTX 3060' (the key in the admin price table)."""
    s = re.sub(r"^(NVIDIA\s+)?(GEFORCE\s+)?", "", (name or "").strip(), flags=re.I)
    s = re.sub(r"\s*\(.*?\)\s*$", "", s)  # '(test stand-in)' etc.
    return re.sub(r"\s+", " ", s).strip()


def price_key(name: str) -> str:
    return short_gpu(name).upper()


def _num(text, unit=""):
    m = re.search(r"(\d+(?:\.\d+)?)\s*" + unit, str(text or ""), flags=re.I)
    return float(m.group(1)) if m else None


def _score(gpu: str):
    """GPU_SCORE uses names like 'RTX 3060 Ti' / 'RTX 4070S'; try a few spellings."""
    s = short_gpu(gpu)
    for cand in (s, s.replace(" SUPER", "S").replace(" Super", "S"), s.title().replace("Rtx", "RTX").replace("Gtx", "GTX")):
        v = gpu_score(cand)
        if v is not None:
            return v
    return None


def check(rental: dict) -> dict:
    """{use: {"ok": bool, "missing": [reasons]}} for one machine."""
    gpu = rental.get("gpu") or ""
    has_gpu = bool(gpu) and not gpu.startswith("CPU only")
    vram = _num(rental.get("vram"), "GB") or 0
    specs = rental.get("specs") or {}
    ram = _num(specs.get("ram"), "GB") or 0
    cores = _num(specs.get("cpu"), "core") or 0
    out = {}
    for use, req in USES.items():
        missing = []
        if not has_gpu:
            missing.append("an NVIDIA GPU")
        elif vram < req["min_vram_gb"]:
            missing.append(f"{req['min_vram_gb']} GB GPU memory (has {vram:g} GB)")
        if ram < req["min_ram_gb"]:
            missing.append(f"{req['min_ram_gb']} GB RAM (has {ram:g} GB)")
        if cores < req["min_cpu_cores"]:
            missing.append(f"{req['min_cpu_cores']} CPU cores (has {cores:g})")
        if req.get("min_gpu_score") and has_gpu and (_score(gpu) or 0) < req["min_gpu_score"]:
            missing.append("an RTX 3060-class GPU or faster")
        if req.get("needs_gamezone_eligible") and not (rental.get("gamezone") or {}).get("eligible"):
            missing.append("Windows Pro with Hyper-V and GPU sharing")
        out[use] = {"ok": not missing, "missing": missing}
    return out


def uses_ok(rental: dict) -> list:
    return [u for u, r in check(rental).items() if r["ok"]]


def use_for_template(template_id: str):
    for use, req in USES.items():
        if template_id in req["templates"]:
            return use
    return None


def public_requirements() -> list:
    return [{"id": u, "name": r["name"], "min_vram_gb": r["min_vram_gb"], "min_ram_gb": r["min_ram_gb"],
             "min_cpu_cores": r["min_cpu_cores"], "later": r["later"],
             "extra": (["RTX 3060-class GPU or faster", "Windows Pro with Hyper-V"] if u == "gamezone" else [])}
            for u, r in USES.items()]
