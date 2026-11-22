"""Gamezone play on rented Vast VMs: machine list, start, setup worker, PG Connect join, end. No network/DB."""

import asyncio
import os
import unittest

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:1")
os.environ.setdefault("DB_NAME", "productify_test")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_EMAIL", "admin@example.com")
os.environ.setdefault("ADMIN_PASSWORD", "x")

from fastapi.testclient import TestClient  # noqa: E402

import server  # noqa: E402
import vast_market  # noqa: E402
from gamezone import vast_play  # noqa: E402
from tests.test_gamezone_node_sessions import _Coll as _BaseColl, _match  # noqa: E402

KEY = "A" * 43 + "="
OFFER = {"offer_id": 77, "machine_id": 501, "gpu": "RTX 4070", "vram_gb": 12, "cpu": "Ryzen 9", "cpu_cores": 8, "ram_gb": 32,
         "location": "Tokyo, JP", "country": "JP", "distance_km": 5800, "down_mbps": 900, "up_mbps": 800,
         "price": 0.62, "score": 170}


class _Coll(_BaseColl):
    async def update_one(self, query, update, upsert=False):
        res = await super().update_one(query, update)
        if upsert and not res.modified_count:
            await self.insert_one({**query, **update.get("$set", {})})
        return res

    async def find_one(self, query, projection=None, sort=None):
        rows = [r for r in self.rows if _match(r, query)]
        if sort:
            key, direction = sort[0]
            rows.sort(key=lambda r: r.get(key) or "", reverse=direction < 0)
        return dict(rows[0]) if rows else None


class _DB:
    def __init__(self, credits=5.0):
        self.instances = _Coll()
        self.rentals = _Coll()
        self.users = _Coll([{"id": "u1", "name": "Player", "email": "p@example.com", "compute_credits": credits}])
        self.gz_bad_machines = _Coll()


class _FakePlay:
    """Stands in for the blocking Vast/SSH helpers."""

    def __init__(self):
        self.rented, self.peers, self.pins, self.ready = [], [], [], True

    def machines_near(self, country, origin=None, limit=12):
        return {"country": country, "searched": [country], "machines": [OFFER], "at": 0}

    def find_offer(self, offer_id):
        return OFFER if offer_id == OFFER["offer_id"] else None

    def rent(self, offer_id, label, resolution="1920x1080"):
        self.rented.append((offer_id, label))
        return 9001

    def check_ready(self, host, port):
        if self.ready == "auth-fails":
            raise type("AuthenticationException", (Exception,), {})("Authentication failed.")
        return {"ready": self.ready, "host_key": KEY, "detail": "installing Steam"}

    def add_peer(self, host, port, key):
        if not vast_play.WG_KEY_RE.fullmatch(key or ""):
            raise ValueError("bad key")
        self.peers.append(key)

    def submit_pin(self, host, port, pin, name):
        self.pins.append(pin)
        return True


class PlayTests(unittest.TestCase):
    def setUp(self):
        self.db, self.fake = _DB(), _FakePlay()
        self._orig = {"db": server.db, "status": vast_market.status, "destroy": vast_market.destroy,
                      "sleep": server.asyncio.sleep, "spawn": server.spawn}
        self._play = {n: getattr(vast_play, n) for n in ("machines_near", "find_offer", "rent", "check_ready",
                                                           "add_peer", "submit_pin", "ssh_key_configured",
                                                           "player_connected")}
        server.db = self.db
        for n in ("machines_near", "find_offer", "rent", "check_ready", "add_peer", "submit_pin"):
            setattr(vast_play, n, getattr(self.fake, n))
        vast_play.ssh_key_configured = lambda: True
        self.connected = False
        vast_play.player_connected = lambda host, port, within=180: self.connected
        self.destroyed = []
        vast_market.status = lambda vid: {"actual_status": "running", "public_ipaddr": "203.0.113.9 ", "dph_total": 0.30,
                                          "ports": {"22/tcp": [{"HostPort": "40022"}], "41641/udp": [{"HostPort": "41641"}]}}
        vast_market.destroy = lambda vid: self.destroyed.append(vid)
        self.spawned = []
        server.spawn = lambda coro: self.spawned.append(coro)
        os.environ["GZ_PLAY_ENABLED"] = "1"
        server.app.dependency_overrides[server.current_user] = lambda: {"id": "u1", "name": "Player", "email": "p@example.com", "role": "buyer"}
        server.app.dependency_overrides[server.optional_user] = lambda: None
        self.c = TestClient(server.app)

    def tearDown(self):
        server.db = self._orig["db"]
        vast_market.status, vast_market.destroy = self._orig["status"], self._orig["destroy"]
        server.spawn = self._orig["spawn"]
        for n, f in self._play.items():
            setattr(vast_play, n, f)
        os.environ.pop("GZ_PLAY_ENABLED", None)
        server.app.dependency_overrides.clear()

    def run_spawned(self):
        async def fast_sleep(_):
            return None
        server.asyncio.sleep = fast_sleep
        try:
            while self.spawned:
                coro = self.spawned.pop(0)
                if asyncio.iscoroutine(coro):
                    asyncio.run(coro)
        finally:
            server.asyncio.sleep = self._orig["sleep"]

    def start(self, launcher="epic"):
        return self.c.post("/api/gamezone/play", json={"offer_id": 77, "launcher": launcher, "country": "JP"})

    def test_machines_show_price_and_region(self):
        r = self.c.get("/api/gamezone/play/machines", headers={"cf-ipcountry": "jp"}).json()
        self.assertTrue(r["enabled"])
        self.assertEqual(r["country"], "JP")
        self.assertEqual(r["machines"][0]["price"], 0.62)
        self.assertEqual({x["id"] for x in r["launchers"]}, {"steam", "epic"})

    def test_hidden_until_enabled(self):
        os.environ.pop("GZ_PLAY_ENABLED")
        self.assertFalse(self.c.get("/api/gamezone/play/machines").json()["enabled"])
        self.assertEqual(self.start().status_code, 404)

    def test_full_session(self):
        r = self.start()
        self.assertEqual(r.status_code, 200, r.text)
        s = r.json()
        self.assertEqual(s["status"], "finding")
        code = s["join_code"]
        # PG Connect is told to wait while the VM starts.
        self.assertEqual(self.c.post(f"/api/gamezone/sessions/{code}/connect", json={"wireguard_public_key": KEY}).status_code, 409)
        self.run_spawned()
        cur = self.c.get("/api/gamezone/play/current").json()["session"]
        self.assertEqual(cur["status"], "running")
        self.assertEqual(self.fake.rented, [(77, f"pfy-{s['id']}")])
        # Real Vast rate 0.30 x 2.05 = 0.615 -> 0.62; listed price kept (never below cost x markup).
        self.assertEqual(cur["hourly_price"], 0.62)
        self.assertFalse(cur["low_credit"])
        j = self.c.post(f"/api/gamezone/sessions/{code}/connect",
                        json={"wireguard_public_key": KEY, "client": {"device_name": "DESK"}})
        self.assertEqual(j.status_code, 200, j.text)
        j = j.json()
        self.assertEqual(j["app"]["name"], "Epic Games")  # what older PG Connect versions open
        self.assertEqual(j["app"]["choices"], ["Steam", "Epic Games"])  # 0.1.8+: switch inside PG Connect
        self.assertEqual(j["host"]["address"], "10.77.0.1")
        self.assertEqual(j["network"]["wireguard"]["endpoint"], "203.0.113.9:41641")
        self.assertEqual(self.fake.peers, [KEY])
        p = self.c.post(f"/api/gamezone/sessions/{code}/pairing",
                        json={"session_id": j["session_id"], "pair_token": "wrong"})
        self.assertEqual(p.status_code, 403)
        p = self.c.post(f"/api/gamezone/sessions/{code}/pairing",
                        json={"session_id": j["session_id"], "pair_token": j["pairing"]["pair_token"]})
        self.assertEqual(p.status_code, 202)
        self.run_spawned()
        self.assertEqual(self.fake.pins, [j["pairing"]["pin"]])
        # A second session while one runs is refused.
        self.assertEqual(self.start().status_code, 409)
        e = self.c.post(f"/api/gamezone/play/{s['id']}/end").json()["session"]
        self.assertEqual(e["status"], "terminated")
        self.run_spawned()
        self.assertEqual(self.destroyed, [9001])  # destroying the VM wipes it
        self.assertEqual(self.c.post(f"/api/gamezone/sessions/{code}/connect", json={"wireguard_public_key": KEY}).status_code, 410)

    def test_steam_launcher(self):
        s = self.start("steam").json()
        self.run_spawned()
        j = self.c.post(f"/api/gamezone/sessions/{s['join_code']}/connect", json={"wireguard_public_key": KEY}).json()
        self.assertEqual(j["app"]["name"], "Steam")

    def test_bad_tunnel_key(self):
        s = self.start().json()
        self.run_spawned()
        r = self.c.post(f"/api/gamezone/sessions/{s['join_code']}/connect", json={"wireguard_public_key": "nope"})
        self.assertEqual(r.status_code, 400)

    def test_end_before_ready_is_free(self):
        s = self.start().json()
        e = self.c.post(f"/api/gamezone/play/{s['id']}/end").json()["session"]
        self.assertEqual((e["status"], e["cost"]), ("terminated", 0.0))
        self.run_spawned()
        self.assertEqual(self.fake.rented, [])  # the worker saw it was ended and rented nothing

    def test_needs_credits(self):
        self.db.users.rows[0]["compute_credits"] = 0.1
        self.assertEqual(self.start().status_code, 402)

    def test_low_credit_flag(self):
        self.assertEqual(self.start().status_code, 200)
        self.run_spawned()
        self.db.users.rows[0]["compute_credits"] = 0.08  # about 7 minutes at $0.62/h
        cur = self.c.get("/api/gamezone/play/current").json()["session"]
        self.assertTrue(cur["low_credit"])  # the page shows the top-up popup
        self.assertLessEqual(cur["minutes_left"], 10)

    # --- zero balance: 5-minute grace, top-up of at least 30 minutes, then stop ---
    def running_session(self):
        self.assertEqual(self.start().status_code, 200)
        self.run_spawned()
        self.spawned.clear()
        return self.db.instances.rows[0]

    def enforce(self):
        asyncio.run(server.enforce_credit_limits())

    def ago(self, **kw):
        return (server.datetime.now(server.timezone.utc) - server.timedelta(**kw)).isoformat()

    def test_zero_balance_starts_grace_and_emails(self):
        inst = self.running_session()
        self.db.users.rows[0]["compute_credits"] = 0.0
        self.enforce()
        self.assertEqual(inst["status"], "running")  # not stopped yet
        self.assertTrue(inst["credit_grace_until"])
        self.assertTrue(any("credits_zero" in getattr(c, "__qualname__", "") for c in self.spawned))
        cur = self.c.get("/api/gamezone/play/current").json()["session"]
        self.assertGreater(cur["grace_seconds_left"], 240)
        self.assertGreaterEqual(cur["min_topup"], 0.31)  # 30 min at $0.62/h
        self.assertEqual(self.c.get("/api/credits/alert").json()["grace_until"], inst["credit_grace_until"])
        st = self.c.get(f"/api/gamezone/sessions/{inst['join_code']}/status").json()
        self.assertIn("grace_seconds_left", st)

    def test_no_topup_stops_after_grace(self):
        inst = self.running_session()
        self.db.users.rows[0]["compute_credits"] = 0.0
        self.enforce()
        inst["credit_grace_until"] = self.ago(seconds=1)
        self.enforce()
        self.assertEqual(inst["status"], "terminated")
        self.assertIn("weren't topped up", inst["end_reason"])

    def test_small_topup_does_not_save_the_machine(self):
        inst = self.running_session()
        self.db.users.rows[0]["compute_credits"] = 0.0
        self.enforce()
        self.db.users.rows[0]["compute_credits"] = 0.10  # ~10 min: under the 30-minute minimum
        self.enforce()
        self.assertTrue(inst["credit_grace_until"])
        inst["credit_grace_until"] = self.ago(seconds=1)
        self.enforce()
        self.assertEqual(inst["status"], "terminated")

    def test_enough_topup_ends_grace_and_keeps_running(self):
        inst = self.running_session()
        inst["started_at"] = self.ago(minutes=3)  # 3 grace minutes used: still charged from the new balance
        self.db.users.rows[0]["compute_credits"] = 0.0
        self.enforce()
        self.db.users.rows[0]["compute_credits"] = 0.40
        self.enforce()
        self.assertFalse(inst["credit_grace_until"])
        self.assertEqual(inst["status"], "running")
        self.assertEqual(self.c.get("/api/credits/alert").json(), {})

    # --- nobody connected through PG Connect for 10 minutes ---
    def idle_check(self, inst):
        asyncio.run(server.gamezone_idle_check(inst, server.datetime.now(server.timezone.utc)))

    def test_never_connected_ends_after_10_minutes(self):
        inst = self.running_session()
        inst["started_at"] = self.ago(minutes=9)
        self.idle_check(inst)
        self.assertEqual(inst["status"], "running")
        self.assertLessEqual(self.c.get("/api/gamezone/play/current").json()["session"]["idle_seconds_left"], 60)
        inst["started_at"] = self.ago(minutes=10, seconds=5)
        self.idle_check(inst)
        self.assertEqual(inst["status"], "terminated")
        self.assertIn("nobody was connected", inst["end_reason"])

    def test_connected_player_is_never_idle_stopped(self):
        inst = self.running_session()
        inst["started_at"] = self.ago(hours=2)
        self.connected = True
        self.idle_check(inst)
        self.assertEqual(inst["status"], "running")
        self.assertIsNone(self.c.get("/api/gamezone/play/current").json()["session"]["idle_seconds_left"])

    def test_closed_pg_connect_ends_10_minutes_after_last_seen(self):
        inst = self.running_session()
        inst["started_at"] = self.ago(hours=1)
        inst["player_seen_at"] = self.ago(minutes=5)
        self.idle_check(inst)
        self.assertEqual(inst["status"], "running")
        inst["player_seen_at"] = self.ago(minutes=11)
        self.idle_check(inst)
        self.assertEqual(inst["status"], "terminated")

    def test_unreachable_vm_is_not_counted_as_idle(self):
        inst = self.running_session()
        inst["started_at"] = self.ago(hours=1)
        self.connected = None
        self.idle_check(inst)
        self.assertEqual(inst["status"], "running")

    def test_host_that_never_accepts_our_key_fails_fast_and_is_left_out(self):
        self.fake.ready = "auth-fails"
        vast_play.BAD_MACHINES.clear()
        s = self.start().json()
        self.run_spawned()
        cur = [r for r in self.db.instances.rows if r["id"] == s["id"]][0]
        self.assertEqual((cur["status"], cur["cost_accumulated"]), ("terminated", 0.0))  # not charged
        self.assertEqual(self.destroyed, [9001])
        self.assertTrue(vast_play.is_bad(501))  # this Vast machine is left out of the list now
        doc = self.db.gz_bad_machines.rows[0]
        self.assertEqual(doc["machine_id"], 501)
        vast_play.BAD_MACHINES.clear()

    def test_value_ranking_prefers_cheap_and_reasonably_close(self):
        far_cheap = {"price": 0.23, "distance_km": 5800}
        near_pricey = {"price": 1.90, "distance_km": 4000}
        self.assertLess(vast_play.value_score(far_cheap), vast_play.value_score(near_pricey))
        same_price_closer = {"price": 0.30, "distance_km": 1000}
        same_price_farther = {"price": 0.30, "distance_km": 6000}
        self.assertLess(vast_play.value_score(same_price_closer), vast_play.value_score(same_price_farther))
        self.assertEqual(vast_play.ping_estimate_ms(1000), 25)

    def test_setup_script_fits_vast_limit_and_unpacks(self):
        import base64, gzip, re
        self.assertLess(len(vast_play.ONSTART), vast_play.ONSTART_LIMIT)  # Vast refuses > 16 KB
        self.assertTrue(vast_play.ONSTART.startswith("#!/bin/bash\n"))
        packed = re.search(r"echo '([A-Za-z0-9+/=]+)'", vast_play.ONSTART).group(1)
        script = gzip.decompress(base64.b64decode(packed)).decode()
        self.assertIn("gamezone-game-watchdog", script)
        self.assertNotIn(chr(13), script)

    def test_endpoints_need_identity_udp_port(self):
        self.assertIsNone(vast_play.endpoints({"public_ipaddr": "1.2.3.4", "ports": {"22/tcp": [{"HostPort": "22"}]}}))
        self.assertEqual(vast_play.endpoints({"public_ipaddr": "1.2.3.4", "ports": {
            "22/tcp": [{"HostPort": "2222"}], "5000/udp": [{"HostPort": "61000"}], "41641/udp": [{"HostPort": "41641"}]}}),
            ("1.2.3.4", 2222, 41641))


if __name__ == "__main__":
    unittest.main()
