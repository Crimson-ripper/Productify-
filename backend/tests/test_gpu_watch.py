"""'Notify me when a GPU is free'. No network/DB."""

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


class _Watches(_Coll):
    async def delete_many(self, query):
        self.rows = [r for r in self.rows if not all(r.get(k) == v for k, v in query.items())]


class _DB:
    def __init__(self):
        self.rentals = _Coll([{"id": "r-a", "status": "approved", "gpu": "RTX 3060"},
                              {"id": "r-b", "status": "approved", "gpu": "RTX 4090"}])
        self.instances = _Coll()
        self.gpu_watches = _Watches()


class WatchTests(unittest.TestCase):
    def setUp(self):
        self.db, self._orig = _DB(), server.db
        server.db = self.db
        server.app.dependency_overrides[server.current_user] = lambda: {"id": "u1", "email": "u1@example.com"}
        self.c = TestClient(server.app)
        self.sent = []

        async def fake(to, gpu, rid):
            self.sent.append((to, gpu, rid))
        self.p = mock.patch.object(emailer, "gpu_available", fake)
        self.p.start()

    def tearDown(self):
        self.p.stop()
        server.db = self._orig
        server.app.dependency_overrides.clear()

    def run_check(self, online):
        def avail(r, busy):
            r["availability"] = "available" if r["id"] in online else "offline"
        with mock.patch.object(server, "add_availability", avail):
            async def go():
                await server.notify_available_gpus()
                await asyncio.sleep(0.05)  # let spawned email tasks run
            asyncio.run(go())

    def test_watch_specific_and_any(self):
        self.assertEqual(self.c.post("/api/rentals/r-b/notify").status_code, 200)
        self.assertEqual(self.c.post("/api/rentals/any/notify").status_code, 200)
        self.assertTrue(self.c.post("/api/rentals/r-b/notify").json().get("already"))
        self.assertEqual(self.c.post("/api/rentals/r-zzz/notify").status_code, 404)

        self.run_check(online=set())
        self.assertEqual(self.sent, [])
        self.run_check(online={"r-a"})  # 'any' fires, r-b still waiting
        self.assertEqual(self.sent, [("u1@example.com", "RTX 3060", "r-a")])
        self.run_check(online={"r-a", "r-b"})
        self.assertEqual(self.sent[-1], ("u1@example.com", "RTX 4090", "r-b"))
        self.assertEqual(self.db.gpu_watches.rows, [])  # each request emails once

    def test_unwatch(self):
        self.c.post("/api/rentals/r-a/notify")
        self.c.delete("/api/rentals/r-a/notify")
        self.assertEqual(self.db.gpu_watches.rows, [])


if __name__ == "__main__":
    unittest.main()
