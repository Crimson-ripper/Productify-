"""Unit and integration tests for Productify Currency Engine and Billing Calculations."""

import unittest
from unittest.mock import AsyncMock, patch

from currency_engine.forex import (
    CurrencySyncService,
    SUPPORTED_CURRENCIES,
    FALLBACK_RATES,
)
from currency_engine.billing import (
    calculate_compute_earnings,
    estimate_payout,
    get_commission_rate,
)


class TestForexService(unittest.TestCase):
    """Test suite for live rates, currency conversions, and formatting."""

    def test_default_fallback_rates(self):
        svc = CurrencySyncService()
        self.assertEqual(svc.rates["USD"], 1.0)
        self.assertEqual(svc.rates["INR"], 83.50)
        self.assertEqual(svc.rates["EUR"], 0.92)

    def test_convert_identity(self):
        svc = CurrencySyncService()
        self.assertEqual(svc.convert(100.0, "USD", "USD"), 100.0)
        self.assertEqual(svc.convert(50.0, "INR", "INR"), 50.0)

    def test_convert_usd_to_inr_and_vice_versa(self):
        svc = CurrencySyncService()
        # 10 USD -> 835 INR
        inr = svc.convert(10.0, "USD", "INR")
        self.assertEqual(inr, 835.0)

        # 835 INR -> 10 USD
        usd = svc.convert(835.0, "INR", "USD")
        self.assertEqual(usd, 10.0)

    def test_convert_non_usd_cross_pair(self):
        svc = CurrencySyncService()
        # EUR (0.92) to GBP (0.78)
        # 92 EUR = 100 USD = 78 GBP
        gbp = svc.convert(92.0, "EUR", "GBP")
        self.assertEqual(gbp, 78.0)

    def test_format_currency(self):
        svc = CurrencySyncService()
        self.assertEqual(svc.format_currency(1234.5, "USD"), "$1,234.50")
        self.assertEqual(svc.format_currency(1234.5, "INR"), "₹1,234.50")
        self.assertEqual(svc.format_currency(1500.0, "JPY"), "¥1,500")

    def test_supported_currencies_meta(self):
        svc = CurrencySyncService()
        meta = svc.get_supported_currencies_meta()
        self.assertEqual(meta["base_currency"], "USD")
        self.assertIn("INR", meta["currencies"])
        self.assertEqual(meta["currencies"]["INR"]["symbol"], "₹")


class TestBillingCalculations(unittest.TestCase):
    """Test suite for metered compute earnings and host payout projections."""

    def test_commission_rates(self):
        self.assertEqual(get_commission_rate("pro"), 0.00)
        self.assertEqual(get_commission_rate("plus"), 0.05)
        self.assertEqual(get_commission_rate("free"), 0.10)
        self.assertEqual(get_commission_rate("unknown"), 0.10)

    def test_calculate_compute_earnings_free_tier(self):
        # 3600 seconds (1 hour) at $1.00/hour, free tier (10% fee)
        res = calculate_compute_earnings(
            in_use_seconds=3600.0,
            hourly_rate_usd=1.00,
            seller_tier="free",
            target_currency="USD"
        )
        self.assertEqual(res["billable_hours"], 1.0)
        self.assertEqual(res["gross_amount_usd"], 1.00)
        self.assertEqual(res["commission_amount_usd"], 0.10)
        self.assertEqual(res["net_amount_usd"], 0.90)
        self.assertEqual(res["formatted_net_local"], "$0.90")

    def test_calculate_compute_earnings_pro_tier_inr(self):
        # 7200 seconds (2 hours) at $0.50/hour, pro tier (0% fee), converted to INR
        res = calculate_compute_earnings(
            in_use_seconds=7200.0,
            hourly_rate_usd=0.50,
            seller_tier="pro",
            target_currency="INR"
        )
        self.assertEqual(res["billable_hours"], 2.0)
        self.assertEqual(res["gross_amount_usd"], 1.00)
        self.assertEqual(res["commission_amount_usd"], 0.00)
        self.assertEqual(res["net_amount_usd"], 1.00)
        # In INR with fallback rate of 83.5
        self.assertEqual(res["net_amount_local"], 83.50)
        self.assertEqual(res["formatted_net_local"], "₹83.50")

    def test_estimate_payout_projections(self):
        # 10 hours/day at $1.00/hour, plus tier (5% fee)
        proj = estimate_payout(
            hours_per_day=10.0,
            hourly_rate_usd=1.00,
            target_currency="USD",
            seller_tier="plus"
        )
        # Daily: $10 gross, 5% fee ($0.50) -> $9.50 net
        self.assertEqual(proj["daily"]["net_usd"], 9.50)
        self.assertEqual(proj["daily"]["formatted"], "$9.50")

        # Weekly: $9.50 * 7 = $66.50
        self.assertEqual(proj["weekly"]["net_usd"], 66.50)
        self.assertEqual(proj["weekly"]["formatted"], "$66.50")

        # Monthly: $9.50 * 30 = $285.00
        self.assertEqual(proj["monthly"]["net_usd"], 285.00)
        self.assertEqual(proj["monthly"]["formatted"], "$285.00")


if __name__ == "__main__":
    unittest.main()
