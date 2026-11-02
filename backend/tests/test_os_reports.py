"""Productify OS update/rollback reports (developer feed). No network/DB."""

import os
import unittest

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:1")
os.environ.setdefault("DB_NAME", "productify_test")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_EMAIL", "admin@example.com")
os.environ.setdefault("ADMIN_PASSWORD", "x")

from fastapi.testclient import TestClient  # noqa: E402

import server  # noqa: E402
from tests.test_gamezone_node_sessions import _Coll  # noqa: E402


class _DB:
    def __init__(self):
        self.rentals = _Coll([{"id": "r-ok", "status": "approved", "pairing_token": "ptok_0123456789abcdef"}])
        self.os_reports = _Coll()


class OsReportTests(unittest.TestCase):
    def setUp(self):
        self.db = _DB()
        self._orig = server.db
        server.db = self.db
        self.c = TestClient(server.app)

    def tearDown(self):
        server.db = self._orig
        server.app.dependency_overrides.clear()

    def body(self, **kw):
        return {"rental_id": "r-ok", "event": "rolled_back", "version": "2026.11.02-abc", "detail": "gpu", **kw}

    def test_valid_token_is_stored(self):
        r = self.c.post("/api/os/reports", json=self.body(), headers={"x-node-token": "ptok_0123456789abcdef"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(self.db.os_reports.rows[0]["event"], "rolled_back")

    def test_bad_token_or_event_rejected(self):
        self.assertEqual(self.c.post("/api/os/reports", json=self.body(), headers={"x-node-token": "ptok_wrongwrongwrong1"}).status_code, 401)
        self.assertEqual(self.c.post("/api/os/reports", json=self.body()).status_code, 401)
        self.assertEqual(self.c.post("/api/os/reports", json=self.body(event="rm -rf"),
                                     headers={"x-node-token": "ptok_0123456789abcdef"}).status_code, 400)
        self.assertEqual(self.db.os_reports.rows, [])

    def test_admin_feed_requires_admin(self):
        server.app.dependency_overrides[server.current_user] = lambda: {"id": "u1", "role": "buyer"}
        self.assertEqual(self.c.get("/api/admin/os-reports").status_code, 403)
        server.app.dependency_overrides[server.current_user] = lambda: {"id": "a1", "role": "admin"}
        self.c.post("/api/os/reports", json=self.body(), headers={"x-node-token": "ptok_0123456789abcdef"})
        r = self.c.get("/api/admin/os-reports")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()), 1)


if __name__ == "__main__":
    unittest.main()
