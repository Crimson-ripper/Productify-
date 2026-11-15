"""Admin-set machine prices and minimum hardware per use (2026-11-15). In-memory DB."""

import asyncio
import os
import unittest

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:1")
os.environ.setdefault("DB_NAME", "productify_test")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_EMAIL", "admin@example.com")
os.environ.setdefault("ADMIN_PASSWORD", "x")

from fastapi.testclient import TestClient  # noqa: E402
from mongomock_motor import AsyncMongoMockClient  # noqa: E402

import machine_rules  # noqa: E402
import server  # noqa: E402

GOOD = {"gpu": "NVIDIA GeForce RTX 3060", "vram": "12 GB", "specs": {"ram": "16 GB", "cpu": "6 cores"}}


def run(coro):
    return asyncio.run(coro)


class RulesTests(unittest.TestCase):
    def test_uses_follow_the_minimums(self):
        self.assertEqual(machine_rules.uses_ok(GOOD), ["ai", "basic"])  # Gamezone also needs Windows Pro + Hyper-V
        self.assertEqual(machine_rules.uses_ok({**GOOD, "gamezone": {"eligible": True}}), ["ai", "basic", "gamezone"])
        small = {**GOOD, "specs": {"ram": "8 GB", "cpu": "4 cores"}}
        self.assertEqual(machine_rules.uses_ok(small), ["basic"])
        self.assertIn("16 GB RAM (has 8 GB)", machine_rules.check(small)["ai"]["missing"])
        self.assertEqual(machine_rules.uses_ok({**GOOD, "vram": "4 GB"}), [])
        self.assertEqual(machine_rules.uses_ok({**GOOD, "gpu": "CPU only (no NVIDIA GPU found)", "vram": ""}), [])
        weak = {**GOOD, "gpu": "NVIDIA GeForce GTX 1070", "vram": "8 GB", "gamezone": {"eligible": True}}
        self.assertNotIn("gamezone", machine_rules.uses_ok(weak))  # below RTX 3060 class

    def test_price_key(self):
        self.assertEqual(machine_rules.price_key("NVIDIA GeForce RTX 3060"), "RTX 3060")
        self.assertEqual(machine_rules.price_key("RTX 3060 (test stand-in)"), "RTX 3060")


class PricingTests(unittest.TestCase):
    def setUp(self):
        self._db, self._spawn = server.db, server.spawn
        server.db = AsyncMongoMockClient()["pricing_test"]
        server.spawn = lambda coro: coro.close()
        self.c = TestClient(server.app)
        self.host = self.login("host@example.test", "seller")
        self.admin = self.login("admin@example.test", "admin")

    def tearDown(self):
        server.db, server.spawn = self._db, self._spawn

    def login(self, email, role):
        r = self.c.post("/api/auth/register", json={"name": role, "email": email, "password": "pw-123456789", "role": "seller"})
        self.assertEqual(r.status_code, 200, r.text)
        run(server.db.users.update_one({"email": email}, {"$set": {"email_verified": True, "role": role}}))
        return {"Authorization": f"Bearer {r.json()['token']}"}

    def paired_machine(self, **hw):
        m = self.c.post("/api/seller/machines", headers=self.host).json()
        run(server.db.rentals.update_one({"id": m["id"]}, {"$set": {**GOOD, **hw, "status": "paired"}}))
        return m["id"]

    def rental(self, rid):
        return run(server.db.rentals.find_one({"id": rid}, {"_id": 0}))

    def test_host_cannot_set_the_price(self):
        rid = self.paired_machine()
        r = self.c.post(f"/api/seller/machines/{rid}/publish", headers=self.host, json={"price": 99, "location": "Delhi, IN"})
        self.assertEqual(r.status_code, 200, r.text)
        m = self.rental(rid)
        self.assertEqual(m["status"], "pending")
        self.assertEqual(float(m.get("price") or 0), 0.0)  # the host's 99 is ignored
        self.assertEqual(m["uses"], ["ai", "basic"])

    def test_below_minimum_cannot_be_submitted(self):
        rid = self.paired_machine(vram="4 GB")
        r = self.c.post(f"/api/seller/machines/{rid}/publish", headers=self.host, json={})
        self.assertEqual(r.status_code, 400)
        self.assertIn("minimum", r.json()["detail"])

    def test_admin_prices_by_gpu_table_and_override(self):
        rid = self.paired_machine()
        self.c.post(f"/api/seller/machines/{rid}/publish", headers=self.host, json={})
        # No table price yet: approval needs one.
        self.assertEqual(self.c.post(f"/api/admin/rentals/{rid}/approved", headers=self.admin).status_code, 400)
        self.assertEqual(self.c.post(f"/api/admin/rentals/{rid}/approved", headers=self.host).status_code, 403)
        q = self.c.get("/api/admin/reviews/pending", headers=self.admin).json()
        row = next(x for x in q if x["id"] == rid)
        self.assertIsNone(row["table_price"])
        self.assertTrue(row["requirements_check"]["ai"]["ok"])
        self.assertNotIn("pairing_token", row)
        # Table price for RTX 3060, then approve.
        self.assertEqual(self.c.put("/api/admin/gpu-prices", headers=self.host, json={"gpu": "RTX 3060", "price": 0.3}).status_code, 403)
        r = self.c.put("/api/admin/gpu-prices", headers=self.admin, json={"gpu": "NVIDIA GeForce RTX 3060", "price": 0.3})
        self.assertEqual(r.json()["key"], "RTX 3060")
        ok = self.c.post(f"/api/admin/rentals/{rid}/approved", headers=self.admin)
        self.assertEqual(ok.status_code, 200, ok.text)
        self.assertEqual((self.rental(rid)["price"], self.rental(rid)["price_source"]), (0.3, "table"))
        # Changing the table moves machines that follow it.
        self.c.put("/api/admin/gpu-prices", headers=self.admin, json={"gpu": "RTX 3060", "price": 0.35})
        self.assertEqual(self.rental(rid)["price"], 0.35)
        # A per-machine override sticks when the table changes; clearing it goes back to the table.
        self.c.post(f"/api/admin/rentals/{rid}/price", headers=self.admin, json={"price": 0.5})
        self.c.put("/api/admin/gpu-prices", headers=self.admin, json={"gpu": "RTX 3060", "price": 0.4})
        self.assertEqual(self.rental(rid)["price"], 0.5)
        self.c.post(f"/api/admin/rentals/{rid}/price", headers=self.admin, json={})
        self.assertEqual((self.rental(rid)["price"], self.rental(rid)["price_source"]), (0.4, "table"))

    def test_approve_with_a_price_for_one_machine(self):
        rid = self.paired_machine()
        self.c.post(f"/api/seller/machines/{rid}/publish", headers=self.host, json={})
        ok = self.c.post(f"/api/admin/rentals/{rid}/approved", headers=self.admin, json={"price": 0.28})
        self.assertEqual(ok.status_code, 200, ok.text)
        self.assertEqual((self.rental(rid)["price"], self.rental(rid)["price_source"]), (0.28, "admin"))

    def test_renting_checks_use_and_price(self):
        rid = self.paired_machine(specs={"ram": "8 GB", "cpu": "4 cores"})  # basic only
        run(server.db.rentals.update_one({"id": rid}, {"$set": {"status": "approved", "price": 0.2}}))
        renter = self.login("renter@example.test", "buyer")
        run(server.db.users.update_one({"email": "renter@example.test"}, {"$set": {"compute_credits": 5}}))
        r = self.c.post("/api/instances/deploy", headers=renter, json={"rental_id": rid, "template_id": "jupyter-pytorch"})
        self.assertEqual(r.status_code, 409)
        self.assertIn("16 GB RAM", r.json()["detail"])
        run(server.db.rentals.update_one({"id": rid}, {"$set": {"price": 0}}))
        r = self.c.post("/api/instances/deploy", headers=renter, json={"rental_id": rid, "template_id": "ubuntu-base"})
        self.assertEqual(r.status_code, 409)
        self.assertIn("price", r.json()["detail"])

    def test_requirements_are_public(self):
        uses = {u["id"]: u for u in self.c.get("/api/machines/requirements").json()["uses"]}
        self.assertEqual((uses["ai"]["min_ram_gb"], uses["basic"]["min_ram_gb"]), (16, 8))


if __name__ == "__main__":
    unittest.main()
