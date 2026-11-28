"""Advance GPU requests: pricing, 12-hour rule, status flow. Uses an in-memory Mongo (mongomock-motor)."""

import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:1")
os.environ.setdefault("DB_NAME", "productify_test")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_EMAIL", "admin@example.com")
os.environ.setdefault("ADMIN_PASSWORD", "x")

try:
    from mongomock_motor import AsyncMongoMockClient
except ImportError:  # optional dev dependency
    AsyncMongoMockClient = None

from fastapi.testclient import TestClient  # noqa: E402

import emailer  # noqa: E402
import server  # noqa: E402

RENTER = {"id": "u1", "email": "u1@example.com", "name": "Asha", "role": "user"}
STAFF = {"id": "a1", "email": "admin@example.com", "role": "admin"}


def at(hours):
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


@unittest.skipIf(AsyncMongoMockClient is None, "mongomock-motor not installed")
class GpuRequestTests(unittest.TestCase):
    def setUp(self):
        self._orig = server.db
        server.db = AsyncMongoMockClient()["t"]
        self.user = RENTER
        server.app.dependency_overrides[server.current_user] = lambda: self.user
        self.c = TestClient(server.app)
        self.mails = []

        async def fake(to, name, subject, text):
            self.mails.append(subject)
        self.p = mock.patch.object(emailer, "gpu_request_update", fake)
        self.p.start()

    def tearDown(self):
        self.p.stop()
        server.db = self._orig
        server.app.dependency_overrides.clear()

    def req(self, **kw):
        body = {"gpu": "RTX 4090", "start_at": at(24), "hours": 4, "notify": ["email", "site"], **kw}
        return self.c.post("/api/gpu-requests", json=body)

    def test_prices(self):
        self.assertEqual(self.req(hours=1).json()["price"], 100)
        self.assertEqual(self.req(hours=4).json()["price"], 280)
        self.assertEqual(self.req(hours=10).json()["price"], 700)
        self.assertEqual(self.req(hours=2).status_code, 422)
        self.assertEqual(self.req(hours=3).status_code, 422)

    def test_twelve_hour_rule(self):
        self.assertEqual(self.req(start_at=at(11)).status_code, 422)
        self.assertEqual(self.req(start_at=at(13)).status_code, 200)

    def test_phone_needed_for_whatsapp(self):
        self.assertEqual(self.req(notify=["whatsapp"]).status_code, 422)
        self.assertEqual(self.req(notify=["whatsapp"], phone="+91 98765 43210").status_code, 200)
        self.assertEqual(self.req(notify=[]).status_code, 422)

    def test_full_flow_with_new_time(self):
        rid = self.req().json()["id"]
        self.user = STAFF
        self.assertEqual(self.c.post(f"/api/admin/gpu-requests/{rid}", json={"status": "new_time"}).status_code, 422)
        r = self.c.post(f"/api/admin/gpu-requests/{rid}", json={"status": "new_time", "offered_start": at(30)})
        self.assertEqual(r.json()["status"], "new_time")
        self.user = RENTER
        self.assertEqual(self.c.post(f"/api/gpu-requests/{rid}/pay").status_code, 409)
        self.assertEqual(self.c.post(f"/api/gpu-requests/{rid}/accept-time").json()["status"], "arranging")
        self.user = STAFF
        self.c.post(f"/api/admin/gpu-requests/{rid}", json={"status": "ready"})
        self.user = RENTER
        mine = self.c.get("/api/gpu-requests/mine").json()[0]
        self.assertTrue(mine["unread"])
        self.assertEqual(self.c.post(f"/api/gpu-requests/{rid}/pay").json()["status"], "paid")
        self.user = STAFF
        self.assertEqual(self.c.post(f"/api/admin/gpu-requests/{rid}", json={"status": "active"}).status_code, 422)
        self.c.post(f"/api/admin/gpu-requests/{rid}", json={"status": "active", "access": "ssh user@host"})
        self.user = RENTER
        mine = self.c.get("/api/gpu-requests/mine").json()[0]
        self.assertEqual(mine["access"], "ssh user@host")
        self.assertNotIn("events", mine)
        self.assertIn("Your GPU is ready", self.mails)

    def test_access_hidden_and_staff_only(self):
        rid = self.req().json()["id"]
        self.assertEqual(self.c.get("/api/admin/gpu-requests").status_code, 403)
        self.assertEqual(self.c.post(f"/api/admin/gpu-requests/{rid}", json={"status": "ready"}).status_code, 403)
        self.assertEqual(self.c.post(f"/api/gpu-requests/{rid}/cancel").json()["status"], "cancelled")

    def test_whatsapp_queued_for_staff(self):
        rid = self.req(notify=["whatsapp"], phone="+919876543210").json()["id"]
        self.user = STAFF
        d = self.c.post(f"/api/admin/gpu-requests/{rid}", json={"status": "ready"}).json()
        self.assertEqual(d["manual_messages"][0]["channels"], ["whatsapp"])
        self.assertFalse(d["manual_messages"][0]["sent"])
        self.assertEqual(self.mails, [])


if __name__ == "__main__":
    unittest.main()
