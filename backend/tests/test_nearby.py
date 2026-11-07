"""Nearby machines: searches only on a visit, shared per region for 2 minutes, slower after half the quota."""

import os
import unittest
from unittest import mock

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:1")
os.environ.setdefault("DB_NAME", "productify_test")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_EMAIL", "admin@example.com")
os.environ.setdefault("ADMIN_PASSWORD", "x")

from fastapi.testclient import TestClient  # noqa: E402

import server  # noqa: E402
import vast_market as vm  # noqa: E402


def offer(i, gpu="RTX 3060", vram_gb=12, cost=0.10, geo="Texas, US", rel=0.99):
    return {"id": i, "gpu_name": gpu, "gpu_ram": vram_gb * 1024, "num_gpus": 1, "dph_total": cost, "reliability2": rel,
            "inet_down": 900, "inet_up": 500, "disk_space": 200, "cuda_max_good": 12.4, "verification": "verified",
            "geolocation": geo}


class RegionalTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.offers = {"US": [offer(1), offer(2, cost=0.2)], "IN": []}

        def fake_request(method, path, body=None, timeout=60):
            countries = body.get("geolocation", {}).get("in", [])
            self.calls.append(countries)
            return {"offers": [o for c in countries for o in self.offers.get(c, [])]}
        vm.regional.lists.clear()
        vm.budget.used, vm.budget.blocked_until = 0, 0.0
        self.p = [mock.patch.object(vm, "_request", fake_request), mock.patch.dict(os.environ, {"VAST_API_KEY": "k"})]
        for p in self.p:
            p.start()

    def tearDown(self):
        for p in self.p:
            p.stop()

    def test_region_list_is_shared_for_two_minutes(self):
        vm.regional.get("US", ["US"], now=1000)
        vm.regional.get("US", ["US"], now=1100)     # 100 s later: same list, no new search
        self.assertEqual(len(self.calls), 1)
        vm.regional.get("IN", ["IN"], now=1100)     # another region searches on its own
        vm.regional.get("US", ["US"], now=1121)     # 121 s: new search
        self.assertEqual(self.calls, [["US"], ["IN"], ["US"]])

    def test_window_grows_after_half_the_quota(self):
        for used, window in [(0, 120), (10000, 180), (13000, 240), (16000, 300), (25000, 300)]:
            vm.budget.used = used
            self.assertEqual(vm.budget.window(), window, used)

    def test_quota_used_up_keeps_last_list(self):
        vm.regional.get("US", ["US"], now=1000)
        vm.budget.note_error(vm.VastError('HTTP 429: {"error":"search_quota_exceeded","retry_after":5000}'), now=1000)
        lst = vm.regional.get("US", ["US"], now=2000)
        self.assertEqual((len(self.calls), len(lst["rows"])), (1, 2))

    def test_top_list_order(self):
        rows = vm.valid_rows([offer(1, cost=0.30, rel=0.995), offer(2, cost=0.05), offer(3, "RTX 4090", 24, 0.9),
                              offer(4, cost=0.2, rel=0.999), offer(5, cost=0.25)])
        top = vm.nearby_top(rows)
        self.assertEqual([m["offer_id"] for m in top][:3], [2, 4, 3])   # cheapest, most reliable, best config
        self.assertEqual((top[0]["tag"], top[2]["tag"]), ("Cheapest", "Top configuration"))
        self.assertEqual((top[0]["price_low"], top[0]["price_high"]), (0.08, 0.15))  # $0.05/h cost: x1.55 rounded up, x3
        self.assertNotIn("price", top[0])


class EndpointTests(RegionalTests):
    def setUp(self):
        super().setUp()
        self.c = TestClient(server.app)
        server.NEARBY_CLICKS.clear()
        self.p2 = mock.patch.dict(os.environ, {"PARTNERS_ENABLED": "1"})
        self.p2.start()

    def tearDown(self):
        self.p2.stop()
        super().tearDown()

    def test_visitor_country_and_fallback(self):
        r = self.c.get("/api/partners/nearby", headers={"cf-ipcountry": "US"}).json()
        self.assertEqual((r["country"], len(r["machines"]), r["fallback"]), ("US", 2, []))
        self.offers["PK"] = [offer(9, geo="Pakistan, PK")]
        r = self.c.get("/api/partners/nearby?country=IN").json()   # no machines in India
        self.assertEqual(r["country"], "IN")
        self.assertIn("PK", r["fallback"])
        self.assertEqual([m["offer_id"] for m in r["machines"]], [9])

    def test_refresh_click_limit(self):
        h = {"x-forwarded-for": "9.9.9.9"}
        self.assertEqual(self.c.get("/api/partners/nearby?refresh=1", headers=h).json()["retry_in"], 0)
        self.assertGreater(self.c.get("/api/partners/nearby?refresh=1", headers=h).json()["retry_in"], 0)

    def test_hidden_until_enabled(self):
        with mock.patch.dict(os.environ, {"PARTNERS_ENABLED": ""}):
            self.assertEqual(self.c.get("/api/partners/nearby").json(), {"enabled": False, "machines": []})


if __name__ == "__main__":
    unittest.main()
