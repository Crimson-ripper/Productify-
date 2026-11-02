"""Renting Vast.ai partner machines through Productify. Vast and the agent are faked; no network/DB."""

import asyncio
import os
import time
import unittest
from unittest import mock

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:1")
os.environ.setdefault("DB_NAME", "productify_test")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_EMAIL", "admin@example.com")
os.environ.setdefault("ADMIN_PASSWORD", "x")

from fastapi.testclient import TestClient  # noqa: E402

import emailer  # noqa: E402
import server  # noqa: E402
import vast_market  # noqa: E402
from tests.test_gamezone_node_sessions import _Coll  # noqa: E402

ROW = {"id": "vast-77", "offer_id": 77, "provider": "vast", "title": "RTX 4090 · partner machine", "gpu": "RTX 4090",
       "vram": "24 GB", "location": "Mumbai, IN", "price": 0.58, "cost": 0.40, "specs": {}, "status": "approved",
       "availability": "available", "is_online": True, "partner": True}


class _DB:
    def __init__(self):
        self.rentals = _Coll()
        self.instances = _Coll()
        self.users = _Coll([{"id": "u1", "name": "Ana", "email": "ana@example.com", "compute_credits": 5.0}])


class _Hub:
    def __init__(self):
        self.connected, self.sent = set(), []

    def is_connected(self, rid):
        return rid in self.connected

    async def request(self, rid, frame, timeout):
        self.sent.append(frame)
        return {"ok": True}


class PartnerTests(unittest.TestCase):
    def setUp(self):
        self.db, self.hub = _DB(), _Hub()
        self._orig = (server.db, server.node_hub)
        server.db, server.node_hub = self.db, self.hub
        server.app.dependency_overrides[server.current_user] = lambda: {"id": "u1", "name": "Ana", "email": "ana@example.com", "role": "buyer"}
        self.env = mock.patch.dict(os.environ, {"PARTNERS_ENABLED": "1"})
        self.env.start()
        vast_market.cache.rows, vast_market.cache.at = [dict(ROW)], time.time()
        self.rented, self.destroyed = [], []
        self.patches = [
            mock.patch.object(vast_market, "rent", lambda *a: (self.rented.append(a), 9001)[1]),
            mock.patch.object(vast_market, "destroy", lambda vid: self.destroyed.append(vid)),
            mock.patch.object(server, "spawn", lambda coro: coro.close()),  # run background work explicitly in tests
            mock.patch.object(emailer, "send", mock.AsyncMock(return_value=True)),
        ]
        for p in self.patches:
            p.start()
        self.c = TestClient(server.app)

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.env.stop()
        server.db, server.node_hub = self._orig
        server.app.dependency_overrides.clear()
        vast_market.cache.rows = []

    def deploy(self):
        return self.c.post("/api/instances/deploy", json={"rental_id": "vast-77", "template_id": "jupyter-pytorch"})

    def test_listed_without_cost_and_offer_id(self):
        rows = self.c.get("/api/rentals").json()
        partner = next(r for r in rows if r["id"] == "vast-77")
        self.assertNotIn("cost", partner)
        self.assertNotIn("offer_id", partner)
        self.assertEqual(self.c.get("/api/rentals/vast-77").status_code, 200)
        self.assertEqual(self.c.get("/api/rentals/vast-1").status_code, 404)

    def test_rent_starts_unbilled_then_bills_when_agent_connects(self):
        r = self.deploy()
        self.assertEqual(r.status_code, 200, r.text)
        inst = r.json()
        self.assertEqual((inst["status"], inst["hourly_price"], inst["started_at"]), ("starting", 0.58, None))
        args = self.rented[0]
        self.assertEqual(args[0], 77)
        env = args[3]
        self.assertTrue(env["PFY_TOKEN"].startswith("ptok_") and len(env["PFY_TOKEN"]) == 21)
        self.assertIn("run --direct", args[4])
        self.assertEqual(self.db.rentals.rows[0]["status"], "partner")  # hidden from the public list

        self.hub.connected.add(inst["rental_id"])
        asyncio.run(server.bring_up_partner(inst["id"]))
        saved = self.db.instances.rows[0]
        self.assertEqual(saved["status"], "running")
        self.assertIsNotNone(saved["started_at"])
        self.assertEqual(self.hub.sent[0]["type"], "job.start")

    def test_one_starting_machine_at_a_time_and_credit_check(self):
        self.assertEqual(self.deploy().status_code, 200)
        self.assertEqual(self.deploy().status_code, 409)
        self.db.instances.rows.clear()
        self.db.users.rows[0]["compute_credits"] = 0.1
        self.assertEqual(self.deploy().status_code, 402)

    def test_never_connects_means_no_charge_and_destroyed(self):
        inst = self.deploy().json()
        with mock.patch.object(server, "PARTNER_START_TIMEOUT_S", 0):
            asyncio.run(server.bring_up_partner(inst["id"]))
        saved = self.db.instances.rows[0]
        self.assertEqual((saved["status"], saved["cost_accumulated"], saved["end_reason"]), ("terminated", 0.0, "couldn't start"))
        self.assertEqual(self.destroyed, [9001])

    def test_stop_destroys_the_vast_machine(self):
        inst = self.deploy().json()
        self.hub.connected.add(inst["rental_id"])
        asyncio.run(server.bring_up_partner(inst["id"]))
        saved = self.db.instances.rows[0]
        asyncio.run(server.destroy_partner_machine(saved))
        self.assertEqual(self.destroyed, [9001])

    def test_hidden_until_enabled_except_admins(self):
        with mock.patch.dict(os.environ, {"PARTNERS_ENABLED": ""}):
            self.assertFalse(any(r["id"].startswith("vast-") for r in self.c.get("/api/rentals").json()))
            self.assertEqual(self.deploy().status_code, 404)
            server.app.dependency_overrides[server.current_user] = lambda: {"id": "u1", "name": "Ana", "email": "ana@example.com", "role": "admin"}
            self.assertEqual(self.deploy().status_code, 200)

    def test_gone_offer(self):
        vast_market.cache.rows = []
        self.assertEqual(self.deploy().status_code, 409)


if __name__ == "__main__":
    unittest.main()
