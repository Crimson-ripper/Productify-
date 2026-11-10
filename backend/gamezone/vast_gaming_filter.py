"""Quality-first Vast.ai filter for Gamezone hosts. Read-only: rents nothing.

Picks machines that meet a game profile's minimum hardware even when they cost more, then ranks
by quality before price. Profiles are built from the games' official Steam requirements
(checked 2026-10-22) plus streaming needs (NVENC, upload bandwidth, Sunshine on a VM).

Usage (from backend/):
    py gamezone/vast_gaming_filter.py                                # 1080p-high, worldwide
    py gamezone/vast_gaming_filter.py --profile 1440p-ultra --countries IN TH VN SG AE
    py gamezone/vast_gaming_filter.py --profile esports --allow-containers
    py gamezone/vast_gaming_filter.py --json out.json                # machine-readable shortlist
"""
import argparse
import json
import re
import sys

try:
    from .vast_api import VastError, load_api_key, search_offers
except ImportError:  # run as a script: python vast_gaming_filter.py
    from vast_api import VastError, load_api_key, search_offers

# Rough 1080p raster performance relative to an RTX 3060 (= 100). Used to rank cards and to set
# each profile's floor. Cards without NVENC (A100, H100, A30, B200, CMP mining cards) can't stream
# and are never listed here.
GPU_SCORE = {
    "GTX 1660": 55, "GTX 1660 S": 60, "GTX 1660 Ti": 60, "GTX 1070": 55, "GTX 1070 Ti": 62, "GTX 1080": 68,
    "GTX 1080 Ti": 85, "Titan Xp": 88, "RTX 2060": 72, "RTX 2060S": 82, "RTX 2070": 82, "RTX 2070S": 92,
    "RTX 2080": 98, "RTX 2080S": 103, "RTX 2080 Ti": 120, "Q RTX 6000": 120, "Titan RTX": 125,
    "RTX 3050": 65, "RTX 3060": 100, "RTX 3060 Ti": 122, "RTX 3070": 138, "RTX 3070 Ti": 145,
    "RTX 3080": 170, "RTX 3080 Ti": 190, "RTX 3090": 195, "RTX 3090 Ti": 210,
    "RTX 4060": 118, "RTX 4060 Ti": 135, "RTX 4070": 170, "RTX 4070S": 190, "RTX 4070 Ti": 200,
    "RTX 4070S Ti": 215, "RTX 4080": 245, "RTX 4080S": 250, "RTX 4090": 320,
    "RTX 5060": 135, "RTX 5060 Ti": 150, "RTX 5070": 200, "RTX 5070 Ti": 240, "RTX 5080": 275, "RTX 5090": 400,
    "RTX A2000": 70, "RTX A4000": 125, "RTX A4500": 150, "RTX A5000": 165, "RTX A6000": 195,
    "RTX 4000Ada": 140, "RTX 4500Ada": 180, "RTX 5000Ada": 230, "RTX 6000Ada": 300, "RTX 6000D": 280,
    "RTX PRO 4000": 170, "RTX PRO 4500": 210, "RTX PRO 5000": 260, "RTX PRO 6000 WS": 380,
    "RTX PRO 6000 S": 360, "RTX PRO 6000 Max-Q": 330,
    "Tesla T4": 70, "T4": 70, "A10": 135, "L4": 120, "A40": 190, "L40": 280, "L40S": 290,
}

# Profiles. "gpu_floor" is the GPU_SCORE a card needs; the rest are per-machine minimums.
PROFILES = {
    "esports": {
        "about": "CS2, Valheim, It Takes Two, indie co-op at 1080p60 (min/rec ~GTX 950-1060 class)",
        "gpu_floor": 60, "vram_gb": 6, "cpu_cores": 4, "cpu_ghz": 2.5, "ram_gb": 16, "disk_gb": 120,
        "disk_mbps": 500, "up_mbps": 60, "down_mbps": 200,
    },
    "1080p-high": {
        "about": "GTA V Enhanced (rec RTX 3060 8 GB, i5-9600K, 16 GB, 105 GB SSD), Helldivers 2 (rec RTX 2060), "
                 "Split Fiction at 1080p60 High",
        "gpu_floor": 100, "vram_gb": 8, "cpu_cores": 6, "cpu_ghz": 2.8, "ram_gb": 16, "disk_gb": 200,
        "disk_mbps": 1000, "up_mbps": 100, "down_mbps": 300,
    },
    "1440p-ultra": {
        "about": "Split Fiction rec (RTX 3070 8 GB, i7-11700K, 16 GB) at 1440p60 High; GTA V Ultra",
        "gpu_floor": 165, "vram_gb": 10, "cpu_cores": 8, "cpu_ghz": 3.0, "ram_gb": 32, "disk_gb": 250,
        "disk_mbps": 1500, "up_mbps": 150, "down_mbps": 500,
    },
}

MIN_CUDA = 12.4         # driver >= 550: current Sunshine/NVENC builds and recent Proton
MIN_RELIABILITY = 0.98
SSD_WORDS = ("nvme", "ssd")


def gpu_score(name: str):
    name = (name or "").strip()
    if "laptop" in name.lower():
        return None                     # laptop chips throttle and are often mining rigs
    return GPU_SCORE.get(name)


def build_query(profile: dict, args) -> dict:
    q = {
        "rentable": {"eq": True}, "rented": {"eq": False}, "type": "on-demand",
        "verified": {"eq": True}, "reliability2": {"gte": MIN_RELIABILITY},
        "num_gpus": {"eq": 1}, "gpu_ram": {"gte": profile["vram_gb"] * 1024 - 256},
        "cpu_cores_effective": {"gte": profile["cpu_cores"]}, "cpu_ram": {"gte": profile["ram_gb"] * 1024 - 512},
        "disk_space": {"gte": profile["disk_gb"]}, "disk_bw": {"gte": profile["disk_mbps"]},
        "inet_up": {"gte": profile["up_mbps"]}, "inet_down": {"gte": profile["down_mbps"]},
        "cuda_max_good": {"gte": MIN_CUDA}, "gpu_display_active": {"eq": False},
        "order": [["dph_total", "asc"]], "limit": 512,
    }
    if not args.allow_containers:
        q["vms_enabled"] = {"eq": True}  # Sunshine needs /dev/uinput, which only VMs give
    if args.countries:
        q["geolocation"] = {"in": [c.upper() for c in args.countries]}
    if args.max_price:
        q["dph_total"] = {"lte": args.max_price}
    return q


def quality(offer: dict, profile: dict) -> float:
    """Higher is better. GPU dominates; CPU clock, disk, network and reliability break ties."""
    g = gpu_score(offer.get("gpu_name")) or 0
    cpu = min(offer.get("cpu_ghz") or 0, 5.5) / 5.5
    disk = min(offer.get("disk_bw") or 0, 5000) / 5000
    up = min(offer.get("inet_up") or 0, 1000) / 1000
    rel = max(0.0, ((offer.get("reliability2") or 0) - MIN_RELIABILITY) / (1 - MIN_RELIABILITY))
    return round(g + 25 * cpu + 10 * disk + 10 * up + 10 * rel + (5 if offer.get("static_ip") else 0), 1)


def shortlist(api_key: str, profile_name: str, args) -> list:
    profile = PROFILES[profile_name]
    offers = search_offers(api_key, build_query(profile, args))
    rows = []
    for o in offers:
        g = gpu_score(o.get("gpu_name"))
        if g is None or g < profile["gpu_floor"]:
            continue
        if (o.get("cpu_ghz") or 0) and o["cpu_ghz"] < profile["cpu_ghz"]:
            continue
        if not any(w in (o.get("disk_name") or "").lower() for w in SSD_WORDS) and (o.get("disk_bw") or 0) < 2 * profile["disk_mbps"]:
            continue
        rows.append({
            "offer_id": o["id"], "gpu": o.get("gpu_name"), "gpu_score": g, "vram_gb": round((o.get("gpu_ram") or 0) / 1024),
            "cpu": o.get("cpu_name"), "cpu_cores": round(o.get("cpu_cores_effective") or 0, 1), "cpu_ghz": o.get("cpu_ghz"),
            "ram_gb": round((o.get("cpu_ram") or 0) / 1024), "disk": o.get("disk_name"), "disk_mbps": round(o.get("disk_bw") or 0),
            "up_mbps": round(o.get("inet_up") or 0), "down_mbps": round(o.get("inet_down") or 0),
            "reliability": round((o.get("reliability2") or 0) * 100, 1), "driver": o.get("driver_version"),
            "vm": bool(o.get("vms_enabled")), "static_ip": bool(o.get("static_ip")),
            "location": o.get("geolocation"), "usd_hr": round(o.get("dph_total") or 0, 3),
            "quality": quality(o, profile),
        })
    key = (lambda r: (r["usd_hr"], -r["quality"])) if args.sort == "price" else (lambda r: (-r["quality"], r["usd_hr"]))
    return sorted(rows, key=key)


def main() -> int:
    p = argparse.ArgumentParser(description="Quality-first Vast.ai filter for Gamezone hosts (read-only).")
    p.add_argument("--profile", choices=list(PROFILES), default="1080p-high")
    p.add_argument("--countries", nargs="+", help="2-letter country codes, e.g. IN TH VN SG AE")
    p.add_argument("--max-price", type=float, help="max $/hr (leave unset: quality first)")
    p.add_argument("--allow-containers", action="store_true", help="include non-VM hosts (browser streaming only, no Sunshine input)")
    p.add_argument("--sort", choices=["quality", "price"], default="quality")
    p.add_argument("--limit", type=int, default=20)
    p.add_argument("--json", help="write the full shortlist to this file")
    args = p.parse_args()

    key = load_api_key()
    if not key:
        print("VAST_API_KEY is not set.", file=sys.stderr)
        return 1
    try:
        rows = shortlist(key, args.profile, args)
    except VastError as e:
        print(f"Vast API error: {e}", file=sys.stderr)
        return 1

    prof = PROFILES[args.profile]
    print(f"Profile {args.profile}: {prof['about']}")
    print(f"Minimums: GPU >= RTX 3060 x{prof['gpu_floor'] / 100:.2f}, {prof['vram_gb']} GB VRAM, {prof['cpu_cores']} cores @ "
          f">= {prof['cpu_ghz']} GHz, {prof['ram_gb']} GB RAM, {prof['disk_gb']} GB SSD >= {prof['disk_mbps']} MB/s, "
          f"up {prof['up_mbps']} / down {prof['down_mbps']} Mbps, verified, reliability >= {MIN_RELIABILITY:.0%}, "
          f"driver CUDA >= {MIN_CUDA}, {'VM or container' if args.allow_containers else 'VM (Sunshine-capable)'}\n")
    if not rows:
        print("No machine meets this profile right now. Try --allow-containers, another profile, or fewer --countries.")
    else:
        print(f"{'offer':>9} {'gpu':<16}{'vram':>5}{'cores':>6}{'GHz':>5}{'RAM':>5}{'disk MB/s':>10}{'up':>6}{'rel%':>6} "
              f"{'VM':>3} {'$/hr':>6} {'quality':>8}  location")
        for r in rows[: args.limit]:
            print(f"{r['offer_id']:>9} {str(r['gpu'])[:15]:<16}{r['vram_gb']:>4}G{r['cpu_cores']:>6.0f}{(r['cpu_ghz'] or 0):>5.1f}"
                  f"{r['ram_gb']:>4}G{r['disk_mbps']:>10}{r['up_mbps']:>6}{r['reliability']:>6.1f} {'yes' if r['vm'] else 'no':>3} "
                  f"{r['usd_hr']:>6.3f} {r['quality']:>8.1f}  {r['location']}")
        print(f"\n{len(rows)} machine(s) meet the profile.")
    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump({"profile": args.profile, "minimums": prof, "rows": rows}, f, indent=2)
        print(f"Wrote {args.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
