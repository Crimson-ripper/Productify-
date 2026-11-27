"""Gamezone test machines: an admin gives a VM we already run (E2E) a PG Connect session code. No network/DB."""

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
from gamezone import vast_play  # noqa: E402
from tests.test_gamezone_play import KEY, _DB, _FakePlay  # noqa: E402

ADMIN = {"id": "a1", "name": "Admin", "email": "admin@example.com", "role": "admin"}
BODY = {"host": "216.48.177.6", "gpu": "Tesla T4", "location": "Delhi, IN"}


class TestMachineTests(unittest.TestCase):
    def setUp(self):
        self.db, self.fake = _DB(credits=0.0), _FakePlay()
        self.db.users.rows.append({**ADMIN, "compute_credits": 0.0})
        self._orig = {"db": server.db, "spawn": server.spawn}
        self._play = {n: getattr(vast_play, n) for n in ("check_ready", "add_peer", "submit_pin", "run")}
        server.db = self.db
        for n in ("check_ready", "add_peer", "submit_pin"):
            setattr(vast_play, n, getattr(self.fake, n))
        self.commands = []
        vast_play.run = lambda host, port, cmd, timeout=60: self.commands.append((host, port, cmd)) or (0, "")
        self.spawned = []
        server.spawn = lambda coro: self.spawned.append(coro)
        self.user = ADMIN
        server.app.dependency_overrides[server.current_user] = lambda: self.user
        self.c = TestClient(server.app)

    def tearDown(self):
        server.db, server.spawn = self._orig["db"], self._orig["spawn"]
        for n, f in self._play.items():
            setattr(vast_play, n, f)
        server.app.dependency_overrides.clear()
        server.GZ_PAIRINGS.clear()

    def create(self, **over):
        return self.c.post("/api/admin/gamezone/test-sessions", json={**BODY, **over})

    def test_admin_only(self):
        self.user = {"id": "u1", "role": "buyer"}
        self.assertEqual(self.create().status_code, 403)
        self.assertEqual(self.c.get("/api/admin/gamezone/test-sessions").status_code, 403)

    def test_create_gives_an_unbilled_code(self):
        r = self.create()
        self.assertEqual(r.status_code, 200, r.text)
        code = r.json()["join_code"]
        doc = self.db.instances.rows[0]
        self.assertEqual((doc["provider"], doc["test_machine"], doc["hourly_price"]), ("e2e", True, 0.0))
        self.assertEqual((doc["vm_host"], doc["vm_ssh_port"], doc["wg_port"], doc["wg_host_key"]), (BODY["host"], 22, 51820, KEY))
        self.assertEqual([s["join_code"] for s in self.c.get("/api/admin/gamezone/test-sessions").json()], [code])

    def test_rejects_private_or_bad_addresses(self):
        for host in ("10.77.0.1", "192.168.1.5", "not-an-ip"):
            self.assertEqual(self.create(host=host).status_code, 400, host)
        self.assertEqual(self.db.instances.rows, [])

    def test_machine_not_ready(self):
        self.fake.ready = False
        self.assertEqual(self.create().status_code, 409)
        self.assertEqual(self.db.instances.rows, [])

    def test_one_code_per_machine(self):
        self.assertEqual(self.create().status_code, 200)
        self.assertEqual(self.create().status_code, 409)

    def test_pg_connect_joins_with_the_code(self):
        code = self.create().json()["join_code"]
        r = self.c.post(f"/api/gamezone/sessions/{code}/connect", json={"wireguard_public_key": KEY, "client": {"device_name": "Friend PC"}})
        self.assertEqual(r.status_code, 200, r.text)
        j = r.json()
        self.assertEqual(self.fake.peers, [KEY])
        self.assertEqual(j["network"]["wireguard"]["endpoint"], f"{BODY['host']}:51820")
        self.assertEqual(j["app"]["name"], "Steam")
        self.assertEqual(j["machine"]["hourly_price"], 0.0)
        r = self.c.post(f"/api/gamezone/sessions/{code}/pairing",
                        json={"session_id": j["session_id"], "pair_token": j["pairing"]["pair_token"]})
        self.assertEqual(r.status_code, 202, r.text)
        for coro in self.spawned:
            asyncio.run(coro)
        self.assertEqual(self.fake.pins, [j["pairing"]["pin"]])

    def test_never_stopped_for_credits(self):
        self.create()
        asyncio.run(server.enforce_credit_limits())
        doc = self.db.instances.rows[0]
        self.assertEqual(doc["status"], "running")
        self.assertFalse(doc.get("credit_grace_until"))

    def test_end_retires_the_code_and_disconnects(self):
        s = self.create().json()
        r = self.c.post(f"/api/admin/gamezone/test-sessions/{s['id']}/end")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(self.db.instances.rows[0]["status"], "terminated")
        self.assertIn("gamezone-wg-peer remove-all", self.commands[-1][2])
        r = self.c.post(f"/api/gamezone/sessions/{s['join_code']}/connect", json={"wireguard_public_key": KEY})
        self.assertEqual(r.status_code, 410)


class SubmitPinCommandTests(unittest.TestCase):
    """The PIN submit sends Sunshine 2026.914's pairing_id when it lists one, else the old body."""

    def test_command_reads_the_pairing_id(self):
        seen = []
        orig = vast_play.run
        vast_play.run = lambda host, port, cmd, timeout=60: seen.append(cmd) or (0, '{"status":true}')
        try:
            self.assertTrue(vast_play.submit_pin("203.0.113.9", 22, "1234", "Friend PC"))
        finally:
            vast_play.run = orig
        cmd = seen[0]
        self.assertIn("/api/pin", cmd)
        self.assertIn('"pairing_id"', cmd)
        self.assertIn(f"{vast_play.WG_NET}.2", cmd)


if __name__ == "__main__":
    unittest.main()
