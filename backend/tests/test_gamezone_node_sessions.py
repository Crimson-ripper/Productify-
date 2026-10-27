"""Gamezone sessions on Productify Node machines: start, join code, stop, reconcile. No network/DB."""

import asyncio
import os
import unittest

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:1")
os.environ.setdefault("DB_NAME", "productify_test")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_EMAIL", "admin@example.com")
os.environ.setdefault("ADMIN_PASSWORD", "x")

from fastapi import HTTPException  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import server  # noqa: E402


def _match(doc, query):
    for k, v in query.items():
        have = doc.get(k)
        if isinstance(v, dict):
            if "$in" in v and have not in v["$in"]:
                return False
            if "$ne" in v and have == v["$ne"]:
                return False
        elif have != v:
            return False
    return True


class _Cursor:
    def __init__(self, rows):
        self.rows = rows

    def sort(self, *a, **k):
        return self

    async def to_list(self, n):
        return [dict(r) for r in self.rows[:n]]


class _Coll:
    def __init__(self, rows=None):
        self.rows = rows or []

    async def find_one(self, query, projection=None):
        return next((dict(r) for r in self.rows if _match(r, query)), None)

    def find(self, query, projection=None):
        return _Cursor([r for r in self.rows if _match(r, query)])

    async def insert_one(self, doc):
        self.rows.append(dict(doc))

    async def update_one(self, query, update):
        for r in self.rows:
            if _match(r, query):
                for k, v in update.get("$set", {}).items():
                    r[k] = v
                for k, v in update.get("$inc", {}).items():
                    r[k] = r.get(k, 0) + v
                return type("R", (), {"modified_count": 1})()
        return type("R", (), {"modified_count": 0})()


class _DB:
    def __init__(self):
        self.rentals = _Coll([
            {"id": "r-ok", "status": "approved", "gpu": "RTX 4060", "price": 0.4, "owner_id": "seller-1",
             "gamezone": {"eligible": True}},
            {"id": "r-home", "status": "approved", "gpu": "RTX 3060", "price": 0.3, "gamezone": {"eligible": False}},
        ])
        self.instances = _Coll()
        self.users = _Coll([{"id": "u1", "name": "Renter", "compute_credits": 5.0},
                            {"id": "seller-1", "balance": 0.0}])


class _Hub:
    def __init__(self, fail=None):
        self.sent, self.fail = [], fail

    def is_connected(self, rid):
        return True

    async def request(self, rid, frame, timeout):
        self.sent.append(frame)
        if self.fail and frame["type"] == "game.start":
            raise HTTPException(502, self.fail)
        return {"ok": True, "vm": {"vm": "pfy-gz-" + frame["job_id"], "gpu": "RTX 4060", "secret": "x"}}


class NodeSessionTests(unittest.TestCase):
    def setUp(self):
        self.db, self.hub = _DB(), _Hub()
        self._orig = (server.db, server.node_hub)
        server.db, server.node_hub = self.db, self.hub
        server.app.dependency_overrides[server.current_user] = lambda: {"id": "u1", "name": "Renter", "role": "buyer"}
        self.c = TestClient(server.app)

    def tearDown(self):
        server.db, server.node_hub = self._orig
        server.app.dependency_overrides.clear()

    def start(self, rid="r-ok"):
        return self.c.post("/api/gamezone/node-sessions", json={"rental_id": rid})

    def test_start_returns_code_and_bills_from_vm_start(self):
        r = self.start()
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertRegex(body["join_code"], r"^[A-HJ-NP-Z2-9]{8}$")
        self.assertEqual(self.hub.sent[0]["type"], "game.start")
        inst = self.db.instances.rows[0]
        self.assertEqual((inst["kind"], inst["status"], inst["hourly_price"]), ("game", "running", 0.4))
        self.assertNotIn("secret", inst["vm"])

    def test_refusals_create_nothing(self):
        self.assertEqual(self.start("r-home").status_code, 409)       # not eligible
        self.assertEqual(self.start("r-missing").status_code, 404)
        self.db.users.rows[0]["compute_credits"] = 0.1
        self.assertEqual(self.start().status_code, 402)                # not enough credits
        self.db.users.rows[0]["compute_credits"] = 5.0
        server.node_hub = _Hub(fail="Hyper-V said no")
        r = self.start()
        self.assertEqual(r.status_code, 502)
        self.assertIn("haven't been charged", r.json()["detail"])
        self.assertEqual(self.db.instances.rows, [])

    def test_one_renter_per_machine(self):
        self.assertEqual(self.start().status_code, 200)
        self.assertEqual(self.start().status_code, 409)

    def test_connect_codes(self):
        code = self.start().json()["join_code"]
        self.assertEqual(self.c.post(f"/api/gamezone/sessions/{code}/connect").status_code, 503)  # Phase 3 not built
        self.assertEqual(self.c.post("/api/gamezone/sessions/NOPE2345/connect").status_code, 404)
        self.assertEqual(self.c.post("/api/gamezone/sessions/../connect").status_code, 404)

    def test_stop_removes_vm_and_only_terminate_allowed(self):
        sid = self.start().json()["id"]
        bad = self.c.post(f"/api/instances/{sid}/action", json={"action": "pause"})
        self.assertEqual(bad.status_code, 400)
        ok = self.c.post(f"/api/instances/{sid}/action", json={"action": "terminate"})
        self.assertEqual(ok.status_code, 200, ok.text)
        self.assertEqual(self.hub.sent[-1], {"type": "game.stop", "job_id": sid})
        self.assertEqual(self.db.instances.rows[0]["status"], "terminated")

    def test_reported_job_ids_include_game(self):
        self.assertEqual(server.reported_job_ids({"job_ids": ["a"], "game_id": "gs-1"}), ["a", "gs-1"])
        self.assertEqual(server.reported_job_ids({"job_ids": [], "game_id": ""}), [])
        self.assertIsNone(server.reported_job_ids({}))


if __name__ == "__main__":
    unittest.main()
