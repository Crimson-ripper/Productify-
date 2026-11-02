"""Curating Vast.ai offers into partner listings. No network."""

import os
import time
import unittest
from unittest import mock

import vast_market as vm


def offer(i, gpu="RTX 4090", vram=24576, price=0.40, **kw):
    o = {"id": i, "gpu_name": gpu, "gpu_ram": vram, "num_gpus": 1, "dph_total": price, "reliability2": 0.99,
         "inet_down": 900, "inet_up": 500, "disk_space": 200, "cuda_max_good": 12.4, "verification": "verified",
         "geolocation": "Mumbai, IN", "cpu_cores_effective": 16, "cpu_ram": 65536, "cpu_name": "AMD EPYC"}
    o.update(kw)
    return o


class CurateTests(unittest.TestCase):
    def test_filters_and_markup(self):
        with mock.patch.dict(os.environ, {"VAST_MARKUP": "1.5"}):  # above the 1.45 floor
            rows = vm.curate([
                offer(1),
                offer(2, vram=4096),                  # too little VRAM
                offer(3, reliability2=0.8),           # unreliable
                offer(4, gpu="CMP 170HX"),            # mining card
                offer(5, num_gpus=2),                 # multi-GPU
                offer(6, inet_up=20),                 # slow upload
                offer(7, verification="unverified"),  # not verified
            ])
        self.assertEqual([r["offer_id"] for r in rows], [1])
        r = rows[0]
        self.assertEqual((r["id"], r["price"], r["vram"], r["provider"], r["availability"]), ("vast-1", 0.6, "24 GB", "vast", "available"))
        self.assertTrue(r["partner"])

    def test_cheapest_few_per_model(self):
        rows = vm.curate([offer(i, price=0.1 * i) for i in range(1, 7)] + [offer(99, gpu="RTX 3090", price=0.2)])
        by = {}
        for r in rows:
            by.setdefault(r["gpu"], []).append(r["offer_id"])
        self.assertEqual(by["RTX 4090"], [1, 2, 3])
        self.assertEqual(by["RTX 3090"], [99])

    def test_markup_at_least_45_percent(self):
        for v in ("0.5", "1.2", "abc", ""):
            with mock.patch.dict(os.environ, {"VAST_MARKUP": v}):
                self.assertEqual(vm.markup(), 1.45, v)
        with mock.patch.dict(os.environ, {"VAST_MARKUP": "1.6"}):
            self.assertEqual(vm.markup(), 1.6)

    def test_cache_goes_stale(self):
        c = vm.OfferCache()
        c.rows, c.at = [{"id": "vast-1"}], time.time() - vm.STALE_S - 1
        self.assertEqual(c.fresh(), [])
        self.assertIsNone(c.get("vast-1"))


if __name__ == "__main__":
    unittest.main()
