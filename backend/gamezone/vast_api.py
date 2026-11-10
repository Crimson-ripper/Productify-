"""Minimal Vast.ai REST client for Gamezone experiments (stdlib only).

Reads VAST_API_KEY (and other settings) from the environment or backend/.env.
Never prints the key.
"""
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

API_BASE = "https://console.vast.ai/api"
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class VastError(RuntimeError):
    pass


def env_setting(name: str, default: str = "") -> str:
    """Read a setting from the process environment, falling back to backend/.env."""
    value = os.environ.get(name, "").strip()
    if value:
        return value
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith(f"{name}="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return default


def load_api_key() -> str:
    return env_setting("VAST_API_KEY")


def _request(method: str, path: str, api_key: str, body=None, timeout: int = 60):
    req = urllib.request.Request(
        f"{API_BASE}{path if path.startswith('/v1/') else '/v0' + path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        raise VastError(f"{method} {path} -> HTTP {e.code}: {e.read().decode(errors='replace')[:400]}") from None
    except urllib.error.URLError as e:
        raise VastError(f"{method} {path} -> could not reach Vast: {e.reason}") from None
    return json.loads(raw) if raw else {}


def search_offers(api_key: str, query: dict) -> list:
    return _request("POST", "/bundles/", api_key, query).get("offers", [])


def create_instance(api_key: str, offer_id: int, template_hash: str, disk_gb: int, env: dict, label: str) -> int:
    body = {"template_hash_id": template_hash, "disk": disk_gb, "env": env, "label": label}
    res = _request("PUT", f"/asks/{offer_id}/", api_key, body)
    if not res.get("success") or not res.get("new_contract"):
        raise VastError(f"create failed: {res.get('msg') or res.get('error') or 'unknown error'}")
    return int(res["new_contract"])


def get_instance(api_key: str, instance_id: int) -> dict:
    return _request("GET", f"/instances/{instance_id}/", api_key).get("instances") or {}


def list_instances(api_key: str) -> list:
    # v0 /instances/ list is deprecated; v1 is paginated via next_token.
    rows, token = [], None
    while True:
        res = _request("GET", "/v1/instances/" + (f"?next_token={token}" if token else ""), api_key)
        rows += res.get("instances", [])
        token = res.get("next_token")
        if not token:
            return rows


def attach_ssh_key(api_key: str, instance_id: int, public_key: str) -> None:
    _request("POST", f"/instances/{instance_id}/ssh/", api_key, {"ssh_key": public_key})


def destroy_instance(api_key: str, instance_id: int) -> None:
    _request("DELETE", f"/instances/{instance_id}/", api_key)
