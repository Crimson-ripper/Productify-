"""GPU on demand: order by class, we find and rent a machine. Vast and the agent are faked."""

import asyncio
import os
import time
import unittest
from datetime import datetime, timezone
from unittest import mock

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:1")
os.environ.setdefault("DB_NAME", "productify_test")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_EMAIL", "admin@example.com")
os.environ.setdefault("ADMIN_PASSWORD", "x")

from fastapi.testclient import TestClient  # noqa: E402

import emailer  # noqa: E402
import server  # noqa: E402
import vast_market as vm  # noqa: E402
from tests.test_gamezone_node_sessions import _Coll  # noqa: E402


def row(i, gpu="RTX 3060", vram=12, price=0.10, loc="Poland, PL", rel=0.99):
    return {"id": f"vast-{i}", "offer_id": i, "gpu": gpu, "vram": f"{vram} GB", "vram_gb": vram, "price": price,
            "cost": round(price / 1.45, 3), "location": loc, "reliability": rel, "title": f"{gpu} · partner machine",
            "specs": {}, "partner": True}


class _DB:
    def __init__(self):
        self.rentals, self.instances = _Coll(), _Coll()
        self.users = _Coll([{"id": "u1", "name": "Ana", "email": "ana@example.com", "compute_credits": 5.0}])


class _Hub:
    def __init__(self):
        self.connected, self.sent = set(), []

    def is_connected(self, rid):
        return rid in self.connected

    async def request(self, rid, frame, timeout):
        self.sent.append(frame)
        return {"ok": True}


class ClassTests(unittest.TestCase):
    def test_classes_and_summary(self):
        pool = [row(1), row(2, price=0.2), row(3, "RTX 3090", 24, 0.35), row(4, "RTX 4090", 24, 0.9),
                row(5, "H100 SXM", 80, 3.0), row(6, "RTX 4060 Ti", 16, 0.15)]
        s = {c["id"]: c for c in vm.class_summary(pool)}
        self.assertEqual((s["entry"]["available"], s["entry"]["low"]), (2, 0.1))
        self.assertEqual(s["mid"]["available"], 2)   # 3090 24 GB + 4060 Ti 16 GB
        self.assertEqual(s["high"]["available"], 1)  # 4090
        self.assertEqual(s["datacenter"]["available"], 1)

    def test_candidates_respect_cap_and_distance(self):
        pool = [row(1, price=0.08, loc="Quebec, CA"), row(2, price=0.12, loc="Mumbai, IN"), row(3, price=0.30)]
        india = (21.0, 78.0)
        dist = lambda r: 0 if "IN" in r["location"] else 9000  # noqa: E731
        near = vm.candidates(pool, "entry", 0.15, india, dist, near=True)
        self.assertEqual([r["offer_id"] for r in near], [2, 1])     # near first, over-cap excluded
        cheap = vm.candidates(pool, "entry", 0.15, india, dist, near=False)
        self.assertEqual([r["offer_id"] for r in cheap], [1, 2])    # cheapest first


class OrderTests(unittest.TestCase):
    def setUp(self):
        self.db, self.hub = _DB(), _Hub()
        self._orig = (server.db, server.node_hub)
        server.db, server.node_hub = self.db, self.hub
        server.app.dependency_overrides[server.current_user] = lambda: {"id": "u1", "name": "Ana", "email": "ana@example.com", "role": "buyer"}
        vm.cache.pool, vm.cache.at = [row(1, price=0.09), row(2, price=0.11), row(3, price=0.13)], time.time()
        self.rented, self.destroyed, self.fail_offers = [], [], set()
        self.statuses = {}

        def fake_rent(offer_id, *a):
            if offer_id in self.fail_offers:
                raise vm.VastError("no such ask")
            self.rented.append(offer_id)
            return 9000 + offer_id

        self.patches = [
            mock.patch.dict(os.environ, {"PARTNERS_ENABLED": "1"}),
            mock.patch.object(vm, "rent", fake_rent),
            mock.patch.object(vm, "destroy", lambda v: self.destroyed.append(v)),
            mock.patch.object(vm, "status", lambda v: self.statuses.get(v, {"actual_status": "loading"})),
            mock.patch.object(server, "spawn", lambda coro: coro.close()),
            mock.patch.object(emailer, "send", mock.AsyncMock(return_value=True)),
            mock.patch.object(server.asyncio, "sleep", mock.AsyncMock()),
        ]
        for p in self.patches:
            p.start()
        self.c = TestClient(server.app)

    def tearDown(self):
        for p in self.patches:
            p.stop()
        server.db, server.node_hub = self._orig
        server.app.dependency_overrides.clear()
        vm.cache.pool = []

    def order(self, **kw):
        body = {"class_id": "entry", "max_price": 0.12, "near": False, **kw}
        return self.c.post("/api/instances/order", json=body)

    def token(self):
        return self.db.rentals.rows[0]["pairing_token"]

    def test_order_skips_taken_machine_and_bills_actual_price(self):
        self.fail_offers = {1}
        r = self.order()
        self.assertEqual(r.status_code, 200, r.text)
        inst = r.json()
        self.assertEqual((inst["status"], inst["hourly_price"], inst["max_price"]), ("finding", None, 0.12))
        self.hub.connected.add(inst["rental_id"])
        asyncio.run(server.order_worker(inst["id"], self.token()))
        saved = self.db.instances.rows[0]
        self.assertEqual(self.rented, [2])                 # 1 was taken, 3 is over the cap
        self.assertEqual((saved["status"], saved["hourly_price"]), ("running", 0.11))
        self.assertIsNotNone(saved["started_at"])

    def test_broken_host_is_destroyed_and_next_tried(self):
        inst = self.order().json()
        self.statuses[9001] = {"actual_status": "created", "status_msg": "Error response from daemon: failed to create task"}

        orig_rent = vm.rent

        def rent_then_connect(offer_id, *a):
            v = orig_rent(offer_id, *a)
            if offer_id == 2:
                self.hub.connected.add(inst["rental_id"])
            return v
        with mock.patch.object(vm, "rent", rent_then_connect):
            asyncio.run(server.order_worker(inst["id"], self.token()))
        saved = self.db.instances.rows[0]
        self.assertEqual(self.destroyed, [9001])
        self.assertEqual((saved["status"], saved["hourly_price"]), ("running", 0.11))

    def test_nothing_starts_means_no_charge(self):
        inst = self.order().json()
        with mock.patch.object(server, "ORDER_HOST_TIMEOUT_S", 0), mock.patch.object(server, "ORDER_MAX_ATTEMPTS", 2):
            asyncio.run(server.order_worker(inst["id"], self.token()))
        saved = self.db.instances.rows[0]
        self.assertEqual((saved["status"], saved["cost_accumulated"], saved["end_reason"]), ("terminated", 0.0, "no machine found"))
        self.assertEqual(sorted(self.destroyed), [9001, 9002])

    def test_pages_work_before_a_price_exists(self):
        inst = self.order().json()
        self.assertEqual(self.c.get(f"/api/instances/{inst['id']}").status_code, 200)
        self.assertEqual(self.c.get("/api/instances").status_code, 200)

    def test_stop_while_finding_costs_nothing(self):
        inst = self.order().json()
        r = self.c.post(f"/api/instances/{inst['id']}/action", json={"action": "terminate"})
        self.assertEqual((r.status_code, r.json()["cost_accumulated"]), (200, 0))
        self.assertEqual(self.c.get("/api/instances").status_code, 200)

    def test_stop_during_rent_is_not_undone(self):
        inst = self.order().json()

        def rent_then_stopped(offer_id, *a):
            self.db.instances.rows[0]["status"] = "terminated"
            return 9000 + offer_id
        with mock.patch.object(vm, "rent", rent_then_stopped):
            asyncio.run(server.order_worker(inst["id"], self.token()))
        self.assertEqual(self.db.instances.rows[0]["status"], "terminated")
        self.assertEqual(self.destroyed, [9001])

    def test_taken_listings_do_not_use_up_tries(self):
        vm.cache.pool = [row(i, price=0.05) for i in range(1, 7)]
        self.fail_offers = {1, 2, 3, 4, 5}
        inst = self.order().json()
        self.hub.connected.add(inst["rental_id"])
        with mock.patch.object(server, "ORDER_MAX_ATTEMPTS", 1):
            asyncio.run(server.order_worker(inst["id"], self.token()))
        self.assertEqual(self.db.instances.rows[0]["status"], "running")

    def test_near_me_order_runs(self):
        inst = self.order(near=True, country="IN").json()
        self.hub.connected.add(inst["rental_id"])
        asyncio.run(server.order_worker(inst["id"], self.token()))
        self.assertEqual(self.db.instances.rows[0]["status"], "running")

    def test_restart_closes_orders_without_charge(self):
        inst = self.order().json()
        self.db.instances.rows[0].update(status="starting", vast_instance_id=9001)

        async def go():
            with mock.patch.object(server, "spawn", lambda c: asyncio.ensure_future(c)):
                await server.recover_partner_orders()
                await asyncio.gather(*[t for t in asyncio.all_tasks() if t is not asyncio.current_task()], return_exceptions=True)
        asyncio.run(go())
        saved = self.db.instances.rows[0]
        self.assertEqual((saved["id"], saved["status"], saved["cost_accumulated"]), (inst["id"], "terminated", 0.0))
        self.assertEqual(self.destroyed, [9001])
        self.assertEqual(self.db.users.rows[0]["compute_credits"], 5.0)

    def test_real_rate_raises_price_but_never_above_cap(self):
        inst = self.order().json()   # cap 0.12; the first listing is 0.09
        self.hub.connected.add(inst["rental_id"])
        self.statuses[9001] = {"actual_status": "running", "dph_total": 0.05}   # 0.05 x 2.05 = 0.1025 -> 0.11
        asyncio.run(server.order_worker(inst["id"], self.token()))
        self.assertEqual(self.db.instances.rows[0]["hourly_price"], 0.11)

    def test_real_rate_over_cap_keeps_machine_at_cap(self):
        inst = self.order().json()
        self.hub.connected.add(inst["rental_id"])
        self.statuses[9001] = {"actual_status": "running", "dph_total": 0.5}
        asyncio.run(server.order_worker(inst["id"], self.token()))
        saved = self.db.instances.rows[0]
        self.assertEqual((saved["status"], saved["hourly_price"]), ("running", 0.12))
        self.assertEqual(self.destroyed, [])

    def _running(self, iid, cost):
        self.db.instances.rows.append({"id": iid, "user_id": "u1", "status": "running", "kind": "node",
                                       "started_at": datetime.now(timezone.utc).isoformat(), "hourly_price": 0.2,
                                       "total_runtime_seconds": 0, "cost_accumulated": cost})

    def test_balance_limits_all_machines_together(self):
        self.db.users.rows[0]["compute_credits"] = 2.0
        self._running("a", 1.2)
        self._running("b", 1.2)     # each is under $2, together over it
        asyncio.run(server.enforce_credit_limits())
        self.assertEqual([i["status"] for i in self.db.instances.rows], ["terminated", "terminated"])

    def test_machines_under_balance_keep_running(self):
        self.db.users.rows[0]["compute_credits"] = 5.0
        self._running("a", 1.0)
        self._running("b", 1.0)
        asyncio.run(server.enforce_credit_limits())
        self.assertEqual([i["status"] for i in self.db.instances.rows], ["running", "running"])

    def test_new_order_counts_running_usage(self):
        self.db.users.rows[0]["compute_credits"] = 2.0
        self._running("a", 1.8)     # only $0.20 of the $2 is left
        self.assertEqual(self.order().status_code, 402)

    def _claim_as(self, **fields):
        self.db.users.rows[0].pop("free_credits_claimed_at", None)
        server.app.dependency_overrides[server.current_user] = lambda: {"id": "u1", **fields}
        return self.c.post("/api/credits/claim-free")

    def test_free_credit_needs_verified_email(self):
        self.assertEqual(self._claim_as(password_hash="x", email_verified=False).status_code, 403)
        self.assertEqual(self.db.users.rows[0]["compute_credits"], 5.0)
        r = self._claim_as(password_hash="x", email_verified=True)
        self.assertEqual((r.status_code, r.json()["added"]), (200, 2.0))
        self.assertEqual(self._claim_as().status_code, 200)     # Google sign-in has no password

    def test_refusals(self):
        self.assertEqual(self.order(class_id="nope").status_code, 400)
        self.assertEqual(self.order(max_price=0.05).status_code, 409)   # nothing under the cap
        self.assertEqual(self.order().status_code, 200)
        self.assertEqual(self.order().status_code, 409)                 # one order at a time
        with mock.patch.dict(os.environ, {"PARTNERS_ENABLED": ""}):
            self.assertEqual(self.order().status_code, 404)

    def test_classes_endpoint_hidden_until_enabled(self):
        self.assertTrue(self.c.get("/api/partners/classes").json()["enabled"])
        with mock.patch.dict(os.environ, {"PARTNERS_ENABLED": ""}):
            self.assertEqual(self.c.get("/api/partners/classes").json(), {"enabled": False, "classes": []})


if __name__ == "__main__":
    unittest.main()
