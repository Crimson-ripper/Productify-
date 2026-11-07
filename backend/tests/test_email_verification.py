"""Email sign-ups are locked until they confirm their address."""

import os
import unittest
from datetime import datetime, timedelta, timezone
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
    async def delete_one(self, query):
        before = len(self.rows)
        self.rows = [r for r in self.rows if not all(r.get(k) == v for k, v in query.items() if not isinstance(v, dict))]
        return type("R", (), {"deleted_count": before - len(self.rows)})()


class _DB:
    def __init__(self, users):
        self.users = _Users(users)
        self.instances, self.rentals, self.user_sessions, self.consents = _Coll(), _Coll(), _Coll(), _Coll()


def person(uid, **kw):
    return {"id": uid, "email": f"{uid}@example.com", "name": uid, "role": "buyer", "compute_credits": 0.0, **kw}


class VerificationTests(unittest.TestCase):
    def setUp(self):
        past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        future = (datetime.now(timezone.utc) + timedelta(hours=40)).isoformat()
        self.db = _DB([
            person("new", password_hash="x", email_verified=False, email_verify={"hash": "h1", "expires": future}),
            person("stale", password_hash="x", email_verified=False, email_verify={"hash": "h2", "expires": past}),
            person("ok", password_hash="x", email_verified=True),
            person("google", auth_provider="google"),
        ])
        self._orig = server.db
        server.db = self.db
        self.sent = []
        self.patches = [mock.patch.object(server, "spawn", lambda coro: (self.sent.append(coro.cr_code.co_name), coro.close())),
                        mock.patch.object(emailer, "send", mock.AsyncMock(return_value=True))]
        for p in self.patches:
            p.start()
        self.c = TestClient(server.app)

    def tearDown(self):
        for p in self.patches:
            p.stop()
        server.db = self._orig

    def as_user(self, uid):
        u = next(x for x in self.db.users.rows if x["id"] == uid)
        return {"Authorization": f"Bearer {server.jwt_token(u)}"}

    def test_unverified_account_is_locked(self):
        h = self.as_user("new")
        self.assertEqual(self.c.get("/api/instances", headers=h).status_code, 403)
        self.assertEqual(self.c.post("/api/credits/claim-free", headers=h).status_code, 403)
        me = self.c.get("/api/auth/me", headers=h)
        self.assertEqual((me.status_code, me.json()["email_verified"]), (200, False))

    def test_verified_and_google_accounts_work(self):
        for uid in ("ok", "google"):
            self.assertEqual(self.c.get("/api/instances", headers=self.as_user(uid)).status_code, 200, uid)

    def test_signup_sends_only_the_confirmation_email(self):
        r = self.c.post("/api/auth/register", json={"email": "fresh@example.com", "password": "longpassword1"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn("verify_email", self.sent)
        self.assertNotIn("welcome", self.sent)

    def test_expired_unconfirmed_signup_frees_the_address(self):
        r = self.c.post("/api/auth/register", json={"email": "stale@example.com", "password": "longpassword1"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertNotIn("stale", [u["id"] for u in self.db.users.rows])

    def test_recent_or_confirmed_signups_keep_the_address(self):
        for email in ("new@example.com", "ok@example.com"):
            r = self.c.post("/api/auth/register", json={"email": email, "password": "longpassword1"})
            self.assertEqual(r.status_code, 409, email)


if __name__ == "__main__":
    unittest.main()
