"""Create (or preview) the private "Productify Gamezone Kiosk (VM)" template on Vast.ai.

Usage (from backend/):
    py gamezone/vast_template/create_template.py            # print the template payload only
    py gamezone/vast_template/create_template.py --create   # create it on your Vast account (private)

The template is based on Vast's official "Ubuntu Desktop (VM)" image, which already ships Steam with
Proton, Sunshine, Selkies and Tailscale. Our onstart script locks it down into a kiosk and sets up the
WireGuard tunnel for Productify Connect. Creating a template costs nothing; renting a machine with it does.

Creating VM instances (found in test T-K2, 2026-10-22):
  - Vast requires an SSH key on the *account* (not just the instance) before it creates a VM.
  - Create with template_hash_id (ours, or the official VM template OFFICIAL_VM_TEMPLATE_HASH below);
    creating with the raw image and no template_hash_id failed with "no_such_ask".
  - Filter offers on CPU model as well as GPU: old Xeons such as the E5-2680 v2 are too slow for
    modern games. extra_filters below cannot express CPU generation, so check cpu_name when choosing.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from vast_api import VastError, _request, load_api_key  # noqa: E402

IMAGE = "docker.io/vastai/kvm"
TAG = "ubuntu_desktop_22.04-2025-11-21"   # tag of Vast's recommended "Ubuntu Desktop (VM)" template
OFFICIAL_VM_TEMPLATE_HASH = "715c192fc2a112574ae5a9efb8c46b3b"   # Vast's "Ubuntu Desktop (VM)"; used in T-K2
# 741641/udp is not a real port (> 65535): it asks Vast for one identity-mapped UDP port and Vast picks
# the number (T-K2: 54879/udp <-> 54879). WireGuard listens there so Moonlight can use Sunshine's
# standard ports inside the tunnel. The onstart detects the number; the backend reads it from the
# instance's "ports" map. The image's tailscaled also sits on that port and is disabled by the onstart.
# Selkies (6100) stays available for the no-install browser stream; the portal is token-protected.
ENV = ('-p 1111:1111 -p 3478:3478/udp -p 6100:6100 -p 741641:741641/udp '
       '-e OPEN_BUTTON_TOKEN="1" -e OPEN_BUTTON_PORT="1111" '
       '-e PORTAL_CONFIG="localhost:1111:11111:/:Instance Portal|localhost:6100:16100:/:Selkies Low Latency Desktop" '
       '-e GZ_RESOLUTION="1920x1080" -e GZ_HEROIC_VERSION="2.18.1"')
EXTRA_FILTERS = {
    "vms_enabled": {"eq": True}, "verified": {"eq": True}, "num_gpus": {"eq": 1},
    "reliability2": {"gte": 0.98}, "cuda_max_good": {"gte": 12.4}, "gpu_display_active": {"eq": False},
    "gpu_ram": {"gte": 7900}, "cpu_ram": {"gte": 15800}, "cpu_cores_effective": {"gte": 6},
    "disk_bw": {"gte": 1000}, "inet_up": {"gte": 100}, "inet_down": {"gte": 300}, "compute_cap": {"gte": 750},
}


def payload() -> dict:
    onstart = (Path(__file__).with_name("gamezone_kiosk_onstart.sh")).read_text(encoding="utf-8")
    return {
        "name": "Productify Gamezone Kiosk (VM)",
        "image": IMAGE, "tag": TAG, "env": ENV, "onstart": onstart,
        "runtype": "ssh", "use_ssh": True, "ssh_direct": True, "jup_direct": False, "use_jupyter_lab": False,
        "private": True, "recommended_disk_space": 200,
        "extra_filters": json.dumps(EXTRA_FILTERS),
        "desc": "Locked-down Steam Big Picture / Epic (Heroic) kiosk streamed with Sunshine. Productify Gamezone.",
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--create", action="store_true", help="create the template on Vast (private)")
    args = p.parse_args()
    body = payload()
    shown = {**body, "onstart": f"<{len(body['onstart'])} chars from gamezone_kiosk_onstart.sh>"}
    print(json.dumps(shown, indent=2))
    print("\nInstances: account-level SSH key required; create with template_hash_id "
          f"(official VM template: {OFFICIAL_VM_TEMPLATE_HASH}); also filter offers on cpu_name.")
    if not args.create:
        print("\nPreview only. Re-run with --create to save it on your Vast account.")
        return 0
    try:
        res = _request("POST", "/template/", load_api_key(), body)
    except VastError as e:
        print(f"Vast refused the template: {e}", file=sys.stderr)
        return 1
    tpl = res.get("template") or res
    print("\nCreated:", json.dumps({k: tpl.get(k) for k in ("id", "hash_id", "name", "private")}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
