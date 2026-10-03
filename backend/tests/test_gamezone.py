"""Unit and integration tests for Productify Gamezone subsystem."""

import unittest
from gamezone.pricing import (
    calculate_private_game_pricing,
    calculate_session_metered_cost,
    PLATFORM_FEE_PERCENT,
    TAX_PERCENT,
)
from gamezone.seed_data import CURATED_GAMES
from gamezone.models import (
    GameCreateInput,
    GameSubmitInput,
    GameSubmissionReviewInput,
    PrivateGameUploadInput,
)


class TestGamezonePricing(unittest.TestCase):
    """Test suite for Gamezone pricing mathematics and fee splits."""

    def test_fee_percentages(self):
        self.assertEqual(PLATFORM_FEE_PERCENT, 0.10)
        self.assertEqual(TAX_PERCENT, 0.05)

    def test_private_game_pricing_formula(self):
        # Base GPU rate: $0.60/hr
        # Platform fee (10%): $0.06/hr
        # Taxes (5%): $0.03/hr
        # Total: $0.69/hr
        res = calculate_private_game_pricing(0.60, target_currency="USD")
        self.assertEqual(res["gpu_base_rate_usd"], 0.60)
        self.assertEqual(res["platform_fee_usd"], 0.06)
        self.assertEqual(res["tax_usd"], 0.03)
        self.assertEqual(res["total_hourly_usd"], 0.69)
        self.assertEqual(res["total_hourly_credits"], 0.69)
        self.assertEqual(res["formatted_total_local"], "$0.69")

    def test_private_game_pricing_inr_conversion(self):
        # Rate in USD: 1.00 -> 10% fee (0.10) -> 5% tax (0.05) -> Total: 1.15 USD
        # Converted to INR (rate 83.50): 1.15 * 83.5 = 96.025 -> 96.02
        res = calculate_private_game_pricing(1.00, target_currency="INR")
        self.assertEqual(res["currency"], "INR")
        self.assertEqual(res["total_hourly_usd"], 1.15)
        self.assertAlmostEqual(res["total_hourly_local"], 96.02, delta=0.5)

    def test_session_metered_cost_calculation(self):
        # 1800 seconds (0.5 hours) at 1.50 credits/hr -> 0.75 credits
        cost = calculate_session_metered_cost(1.50, 1800.0)
        self.assertEqual(cost["runtime_hours"], 0.5)
        self.assertEqual(cost["cost_credits"], 0.75)
        self.assertEqual(cost["formatted_cost"], "$0.75")

        # 3600 seconds (1 hour) at 2.00 credits/hr -> 2.00 credits
        cost2 = calculate_session_metered_cost(2.00, 3600.0)
        self.assertEqual(cost2["cost_credits"], 2.00)


class TestGamezoneSeedAndSchemas(unittest.TestCase):
    """Test suite for seed data integrity and Pydantic model validation."""

    def test_curated_seed_games_count_and_fields(self):
        self.assertGreaterEqual(len(CURATED_GAMES), 6)
        for g in CURATED_GAMES:
            self.assertTrue(g["id"].startswith("game-"))
            self.assertTrue(len(g["title"]) > 0)
            self.assertGreaterEqual(g["hourly_rate_credits"], 0.1)
            self.assertEqual(g["status"], "published")
            self.assertIn("min_gpu_vram", g)

    def test_game_create_model_validation(self):
        model = GameCreateInput(
            title="Elden Ring",
            genre="Action / RPG",
            hourly_rate_credits=2.50,
            min_gpu_vram="12 GB"
        )
        self.assertEqual(model.title, "Elden Ring")
        self.assertEqual(model.hourly_rate_credits, 2.50)

    def test_game_submit_model_validation(self):
        sub = GameSubmitInput(
            title="My Indie Game",
            package_url="https://cloud.com/build.zip",
            suggested_hourly_rate=0.75
        )
        self.assertEqual(sub.version, "v1.0.0")
        self.assertEqual(sub.suggested_hourly_rate, 0.75)

    def test_game_submission_review_decision_check(self):
        rev = GameSubmissionReviewInput(
            decision="approve",
            antivirus_scanned=True,
            no_crypto_miners=True,
            headless_gpu_tested=True,
            content_policy_passed=True,
            admin_notes="Clean binary scan verified."
        )
        self.assertEqual(rev.decision, "approve")
        self.assertTrue(rev.antivirus_scanned)

    def test_private_game_upload_input(self):
        upload = PrivateGameUploadInput(
            title="Custom GTA Mod",
            package_url="https://s3.com/private/gta-mod.zip",
            package_size_gb=45.2,
            launch_executable="PlayGTA.exe"
        )
        self.assertEqual(upload.launch_executable, "PlayGTA.exe")
        self.assertEqual(upload.package_size_gb, 45.2)

    def test_streaming_credentials_format(self):
        wan_ip = "122.161.64.41"
        port = 47989
        pin = "4819"
        moonlight_uri = f"moonlight://{wan_ip}:{port}?pin={pin}"
        self.assertTrue(moonlight_uri.startswith("moonlight://"))
        self.assertIn("pin=4819", moonlight_uri)
        self.assertEqual(port, 47989)


if __name__ == "__main__":
    unittest.main()
