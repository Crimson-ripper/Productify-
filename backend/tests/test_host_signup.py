"""Host sign-up fixes (2026-11-10): real seller email codes, email lock only for new sign-ups,
no CPU-only listings, recovery can't mark a new address verified. In-memory DB, no real email."""

import os
import re
import unittest

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:1")
os.environ.setdefault("DB_NAME", "productify_test")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_EMAIL", "admin@example.com")
os.environ.setdefault("ADMIN_PASSWORD", "x")

from fastapi.testclient import TestClient  # noqa: E402
from mongomock_motor import AsyncMongoMockClient  # noqa: E402

import emailer  # noqa: E402
import server  # noqa: E402


class HostSignupTests(unittest.TestCase):
    def setUp(self):
        self._db, self._send, self._spawn = server.db, emailer.send, server.spawn
        server.db = AsyncMongoMockClient()["host_signup_test"]
        self.sent = []

        async def fake_send(to, subject, html, text):
            self.sent.append((to, subject, text))
            return True
        emailer.send = fake_send
        server.spawn = lambda coro: coro.close()  # background emails aren't needed here
        self.c = TestClient(server.app)

    def tearDown(self):
        server.db, emailer.send, server.spawn = self._db, self._send, self._spawn
        server.app.dependency_overrides.clear()

    def register(self, email="host@example.test"):
        r = self.c.post("/api/auth/register", json={"name": "Host", "email": email, "password": "pw-123456789", "role": "seller"})
        self.assertEqual(r.status_code, 200, r.text)
        return {"Authorization": f"Bearer {r.json()['token']}"}

    def run_async(self, coro):
        import asyncio
        return asyncio.run(coro)

    def test_new_signup_is_locked_until_confirmed(self):
        h = self.register()
        self.assertEqual(self.c.get("/api/seller/analytics", headers=h).status_code, 403)
        self.assertFalse(self.c.get("/api/auth/me", headers=h).json()["email_verified"])

    def test_accounts_from_before_the_lock_still_work(self):
        h = self.register()
        # An account made before the lock has no email_verified field at all.
        self.run_async(server.db.users.update_many({}, {"$unset": {"email_verified": ""}}))
        self.assertNotEqual(self.c.get("/api/seller/analytics", headers=h).status_code, 403)
        self.assertTrue(self.c.get("/api/auth/me", headers=h).json()["email_verified"])

    def test_seller_email_code_is_emailed_not_returned(self):
        h = self.register()
        self.run_async(server.db.users.update_many({}, {"$set": {"email_verified": True}}))
        self.sent.clear()
        r = self.c.post("/api/seller/verify/send-code", headers=h, json={"type": "email", "value": "host@example.test"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertNotIn("debug_code", r.json())
        self.assertNotRegex(r.text, r"\b\d{6}\b")  # the code never reaches the browser
        to, subject, text = self.sent[-1]
        self.assertEqual(to, "host@example.test")
        self.assertNotRegex(subject, r"\d{6}")  # the code never goes into logged subjects
        code = re.search(r"\b(\d{6})\b", text).group(1)
        rec = self.run_async(server.db.verification_codes.find_one({}))
        self.assertNotIn("code", rec)  # stored only as a hash
        # Wrong codes count; five wrong tries lock the code.
        for _ in range(5):
            self.assertEqual(self.c.post("/api/seller/verify/confirm-code", headers=h,
                                         json={"type": "email", "value": "host@example.test", "code": "000000"}).status_code, 400)
        self.assertEqual(self.c.post("/api/seller/verify/confirm-code", headers=h,
                                     json={"type": "email", "value": "host@example.test", "code": code}).status_code, 429)

    def test_seller_activation_with_real_email_code(self):
        h = self.register()
        self.run_async(server.db.users.update_many({}, {"$set": {"email_verified": True}}))
        # Before confirming the seller email code, activation is refused for a never-confirmed account.
        self.run_async(server.db.users.update_many({}, {"$set": {"email_verified": False}}))
        self.assertEqual(self.c.post("/api/seller/activate", headers=h, json={"phone": "+91 98765 43210"}).status_code, 403)
        self.run_async(server.db.users.update_many({}, {"$unset": {"email_verified": ""}}))
        self.assertEqual(self.c.post("/api/seller/activate", headers=h, json={"phone": "+91 98765 43210"}).status_code, 400)
        self.sent.clear()
        self.c.post("/api/seller/verify/send-code", headers=h, json={"type": "email", "value": "host@example.test"})
        code = re.search(r"\b(\d{6})\b", self.sent[-1][2]).group(1)
        ok = self.c.post("/api/seller/verify/confirm-code", headers=h, json={"type": "email", "value": "host@example.test", "code": code})
        self.assertEqual(ok.status_code, 200, ok.text)
        r = self.c.post("/api/seller/activate", headers=h, json={"phone": "+91 98765 43210"})
        self.assertEqual(r.status_code, 200, r.text)
        u = r.json()["user"]
        self.assertTrue(u["email_verified"])
        self.assertFalse(u["phone_verified"])  # no SMS provider: kept as a contact number only

    def test_new_signup_can_confirm_with_emailed_code(self):
        h = self.register()  # unconfirmed: everything else is locked, but the code flow works
        self.sent.clear()
        self.assertEqual(self.c.post("/api/seller/verify/send-code", headers=h, json={"type": "email", "value": "host@example.test"}).status_code, 200)
        code = re.search(r"\b(\d{6})\b", self.sent[-1][2]).group(1)
        self.assertEqual(self.c.post("/api/seller/verify/confirm-code", headers=h,
                                     json={"type": "email", "value": "host@example.test", "code": code}).status_code, 200)
        self.assertTrue(self.c.get("/api/auth/me", headers=h).json()["email_verified"])
        self.assertNotEqual(self.c.get("/api/seller/analytics", headers=h).status_code, 403)

    def test_phone_codes_are_not_faked(self):
        h = self.register()
        self.run_async(server.db.users.update_many({}, {"$set": {"email_verified": True}}))
        r = self.c.post("/api/seller/verify/send-code", headers=h, json={"type": "phone", "value": "+91 98765 43210"})
        self.assertEqual(r.status_code, 501)

    def test_cpu_only_machine_cannot_be_published(self):
        h = self.register()
        self.run_async(server.db.users.update_many({}, {"$set": {"email_verified": True}}))
        m = self.c.post("/api/seller/machines", headers=h).json()
        self.run_async(server.db.rentals.update_one({"id": m["id"]}, {"$set": {"gpu": "CPU only (no NVIDIA GPU found)", "vram": "", "status": "paired"}}))
        r = self.c.post(f"/api/seller/machines/{m['id']}/publish", headers=h, json={"price": 0.25})
        self.assertEqual(r.status_code, 400)
        self.assertIn("NVIDIA", r.json()["detail"])
        self.run_async(server.db.rentals.update_one({"id": m["id"]}, {"$set": {"gpu": "RTX 3060", "vram": "12 GB"}}))
        self.assertEqual(self.c.post(f"/api/seller/machines/{m['id']}/publish", headers=h, json={"price": 0.25}).status_code, 200)

    def test_admin_seed_is_not_locked(self):
        self.run_async(server.seed())
        admin = self.run_async(server.db.users.find_one({"role": "admin"}))
        self.assertFalse(server.email_unverified(admin))


if __name__ == "__main__":
    unittest.main()
