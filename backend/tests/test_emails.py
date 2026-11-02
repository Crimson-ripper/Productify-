"""Email verification and transactional emails (Resend mocked). No network/DB."""

import asyncio
import os
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
from tests.test_gamezone_node_sessions import _Coll  # noqa: E402


class _Users(_Coll):
    async def find_one(self, query, projection=None):
        for r in self.rows:
            if all((r.get("email_verify") or {}).get("hash") == v if k == "email_verify.hash" else r.get(k) == v
                   for k, v in query.items()):
                return dict(r)
        return None

    async def update_one(self, query, update):
        res = await super().update_one(query, update)
        for r in self.rows:
            if all(r.get(k) == v for k, v in query.items()):
                for k in update.get("$unset", {}):
                    r.pop(k, None)
        return res


class _DB:
    def __init__(self):
        self.users = _Users()
        self.consents = _Coll()
        self.consent_log = _Coll()

    def __getattr__(self, name):  # any other collection
        c = _Coll()
        setattr(self, name, c)
        return c


class EmailTests(unittest.TestCase):
    def setUp(self):
        self.db = _DB()
        self._orig = server.db
        server.db = self.db
        self.sent = []

        async def fake_send(to, subject, html, text):
            self.sent.append((to, subject, text))
            return True
        self.p = mock.patch.object(emailer, "send", fake_send)
        self.p.start()
        self.c = TestClient(server.app)

    def tearDown(self):
        self.p.stop()
        server.db = self._orig
        server.app.dependency_overrides.clear()

    def flush(self):
        asyncio.get_event_loop_policy()  # tasks run on TestClient's loop; give them a moment
        import time
        time.sleep(0.2)

    def test_register_sends_verification_and_welcome_then_verify(self):
        r = self.c.post("/api/auth/register", json={"email": "Ana@Example.com", "password": "longpassword1", "name": "Ana"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertFalse(r.json()["user"]["email_verified"])
        self.flush()
        subjects = [s[1] for s in self.sent]
        self.assertIn("Confirm your email for Productify", subjects)
        self.assertIn("Welcome to Productify", subjects)
        text = next(t for _, s, t in self.sent if s.startswith("Confirm"))
        token = text.split("token=")[1].split()[0]
        ok = self.c.post("/api/auth/verify-email", json={"token": token})
        self.assertEqual(ok.status_code, 200, ok.text)
        self.assertTrue(self.db.users.rows[0]["email_verified"])
        again = self.c.post("/api/auth/verify-email", json={"token": token})
        self.assertEqual(again.status_code, 400)  # single use

    def test_bad_token(self):
        self.assertEqual(self.c.post("/api/auth/verify-email", json={"token": "x" * 40}).status_code, 400)

    def test_email_skipped_without_key(self):
        self.p.stop()
        with mock.patch.dict(os.environ, {"RESEND_API_KEY": ""}):
            self.assertFalse(asyncio.run(emailer.send("a@b.c", "s", "<p>h</p>", "t")))
        self.p.start()


if __name__ == "__main__":
    unittest.main()
