"""Tests for the Gamezone live inventory (gamezone/inventory.py, gamezone/geo.py). No network."""

import unittest
from unittest import mock

from gamezone import geo, inventory


def vast_offer(mid, gpu="RTX 3060", n=1, vram_mb=12288, geo_text="Mumbai, IN", **kw):
    return {"machine_id": mid, "gpu_name": gpu, "num_gpus": n, "gpu_ram": vram_mb, "cpu_name": "AMD Ryzen 9 5950X",
            "cpu_cores_effective": 16, "cpu_ram": 65536, "disk_space": 500, "geolocation": geo_text,
            "vms_enabled": False, "inet_up": 800, "dph_total": 0.2, **kw}


def node_rental(rid, gpu="NVIDIA GeForce RTX 4060 Laptop GPU", availability="available", status="approved", location="Delhi, IN"):
    return {"id": rid, "gpu": gpu, "vram": "8 GB", "status": status, "availability": availability,
            "location": location, "is_verified": True, "price": 1.0}


class GeoTests(unittest.TestCase):
    def test_locate_city_then_country(self):
        self.assertEqual(geo.locate("Mumbai, IN"), geo.CITIES["mumbai"])
        self.assertEqual(geo.locate("Somewhere, DE"), geo.COUNTRIES["DE"])
        self.assertEqual(geo.locate("Pune, India"), geo.CITIES["pune"])
        self.assertIsNone(geo.locate(""))
        self.assertIsNone(geo.locate("Atlantis"))

    def test_distance(self):
        d = geo.km_between(geo.CITIES["delhi"], geo.CITIES["mumbai"])
        self.assertTrue(1100 < d < 1200, d)


class AdapterTests(unittest.TestCase):
    def test_vast_keeps_largest_offer_per_machine_and_hides_prices(self):
        offers = [vast_offer(1, n=1), vast_offer(1, n=4), vast_offer(2, gpu="RTX 5090", vram_mb=32768, geo_text="Frankfurt, DE")]
        with mock.patch.object(inventory, "search_offers", return_value=offers):
            rows = inventory.vast_machines("key")
        self.assertEqual(len(rows), 2)
        m1 = next(r for r in rows if r["id"] == "vast-1")
        self.assertEqual(m1["gpu_count"], 4)
        self.assertEqual((m1["gpu_vram_gb"], m1["ram_gb"], m1["cpu_cores"]), (12, 64, 16))
        self.assertEqual(m1["country"], "IN")
        self.assertEqual(m1["gpu_cores"], 3584)
        self.assertTrue(all("price" not in k and "dph" not in k for r in rows for k in r))

    def test_node_only_free_approved_gpu_machines(self):
        rentals = [node_rental("a"), node_rental("b", availability="in_use"), node_rental("c", status="pending"),
                   node_rental("d", availability="offline"), node_rental("e", gpu="CPU only (no NVIDIA GPU found)")]
        meta = {"a": {"gpu": "NVIDIA GeForce RTX 4060 Laptop GPU", "vram_mb": 8188, "cpu_cores": 20, "ram_mb": 16000, "cpu": "Intel i7"}}
        rows = inventory.node_machines(rentals, meta)
        self.assertEqual([r["id"] for r in rows], ["node-a"])
        self.assertEqual(rows[0]["gpu_model"], "RTX 4060 Laptop GPU")
        self.assertEqual((rows[0]["gpu_vram_gb"], rows[0]["cpu_cores"], rows[0]["ram_gb"]), (8, 20, 16))

    def test_streaming_ok(self):
        self.assertTrue(inventory.streaming_ok("RTX 3060", 12))
        self.assertTrue(inventory.streaming_ok("L4", 24))
        self.assertFalse(inventory.streaming_ok("H100 SXM", 80))
        self.assertFalse(inventory.streaming_ok("A100 PCIE", 40))
        self.assertFalse(inventory.streaming_ok("GTX 1050", 4))


class StoreTests(unittest.TestCase):
    def test_stale_provider_is_hidden_and_failures_keep_last_snapshot(self):
        s = inventory.InventoryStore()
        s.put("vast", [{"id": "vast-1"}], now=1000)
        s.put("productify", [{"id": "node-a"}], now=1200)
        self.assertEqual(len(s.machines(now=1250)), 2)
        s.fail("vast", "HTTP 500")
        self.assertEqual(len(s.machines(now=1250)), 2)  # last good snapshot still fresh
        self.assertEqual([m["id"] for m in s.machines(now=1000 + inventory.STALE_AFTER_S + 1)], ["node-a"])
        st = s.status(now=1250)
        self.assertEqual(st["vast"]["error"], "HTTP 500")
        self.assertTrue(st["productify"]["fresh"])


def rows():
    with mock.patch.object(inventory, "search_offers", return_value=[
        vast_offer(1, geo_text="Mumbai, IN"), vast_offer(2, geo_text="Mumbai, IN"),
        vast_offer(3, gpu="RTX 5090", vram_mb=32768, geo_text="Frankfurt, DE"),
        vast_offer(4, gpu="H100 SXM", vram_mb=81920, geo_text="Delhi, IN"),
        vast_offer(5, gpu="RTX 4090", vram_mb=24576, geo_text="Nowhere"),
    ]):
        return inventory.vast_machines("k") + inventory.node_machines([node_rental("a")], {})


class QueryTests(unittest.TestCase):
    def test_group_nearest_first_with_recommendation(self):
        groups = inventory.group_by_gpu(rows(), origin=geo.CITIES["pune"])
        names = [g["gpu_model"] for g in groups]
        self.assertNotIn("H100 SXM", names)  # no NVENC/graphics: not offered for games
        self.assertEqual(names[0], "RTX 3060")  # Mumbai is nearest to Pune
        self.assertEqual(groups[0]["available"], 2)
        self.assertTrue(groups[0]["recommended"])
        self.assertEqual(sum(g["recommended"] for g in groups), 1)
        self.assertEqual(names[-1], "RTX 4090")  # unknown location sorts last

    def test_minimum_requirement_moves_too_small_gpus_down(self):
        groups = inventory.group_by_gpu(rows(), origin=geo.CITIES["pune"], min_vram_gb=16)
        rec = next(g for g in groups if g["recommended"])
        self.assertGreaterEqual(rec["gpu_vram_gb"], 16)
        self.assertFalse(next(g for g in groups if g["gpu_model"] == "RTX 3060")["meets_minimum"])

    def test_search_filters(self):
        r = rows()
        self.assertEqual({m["gpu_model"] for m in inventory.search(r, gpu_model="5090")}, {"RTX 5090"})
        self.assertTrue(all(m["gpu_vram_gb"] >= 24 for m in inventory.search(r, min_vram_gb=24)))
        near = inventory.search(r, origin=geo.CITIES["mumbai"], max_km=50)
        self.assertEqual({m["id"] for m in near}, {"vast-1", "vast-2"})
        self.assertEqual({m["provider"] for m in inventory.search(r, provider="productify")}, {"productify"})
        self.assertTrue(all("lat" not in m for m in inventory.search(r)))
        self.assertNotIn("H100 SXM", {m["gpu_model"] for m in inventory.search(r, streaming_only=True)})
        self.assertEqual(inventory.search(r, min_cpu_cores=64), [])


if __name__ == "__main__":
    unittest.main()
