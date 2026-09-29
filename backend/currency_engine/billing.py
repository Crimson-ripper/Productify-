"""Compute billing, tier commission management, and multi-currency payout calculation engine."""

import logging
from typing import Dict, Any, Optional
from .forex import currency_service

logger = logging.getLogger("productify.billing")

COMMISSION_TIERS = {
    "pro": 0.00,    # 0% fee (Host keeps 100%)
    "plus": 0.05,   # 5% fee (Host keeps 95%)
    "free": 0.10,   # 10% fee (Host keeps 90%)
}


def get_commission_rate(seller_tier: Optional[str]) -> float:
    """Return platform commission rate for a seller tier."""
    tier = (seller_tier or "free").lower()
    return COMMISSION_TIERS.get(tier, 0.10)


def calculate_compute_earnings(
    in_use_seconds: float,
    hourly_rate_usd: float,
    seller_tier: str = "free",
    target_currency: str = "USD"
) -> Dict[str, Any]:
    """Calculate exact gross and net earnings for metered compute seconds with tier commission and forex conversion."""
    in_use_seconds = max(0.0, float(in_use_seconds))
    hourly_rate_usd = max(0.0, float(hourly_rate_usd))
    hours = in_use_seconds / 3600.0

    gross_usd = round(hours * hourly_rate_usd, 4)
    comm_rate = get_commission_rate(seller_tier)
    comm_usd = round(gross_usd * comm_rate, 4)
    net_usd = round(gross_usd - comm_usd, 4)

    # Convert to host target currency
    target_curr = target_currency.upper()
    gross_local = currency_service.convert(gross_usd, from_curr="USD", to_curr=target_curr)
    net_local = currency_service.convert(net_usd, from_curr="USD", to_curr=target_curr)

    return {
        "in_use_seconds": round(in_use_seconds, 2),
        "billable_hours": round(hours, 4),
        "hourly_rate_usd": hourly_rate_usd,
        "seller_tier": seller_tier,
        "commission_rate": comm_rate,
        "gross_amount_usd": gross_usd,
        "commission_amount_usd": comm_usd,
        "net_amount_usd": net_usd,
        "currency": target_curr,
        "gross_amount_local": gross_local,
        "net_amount_local": net_local,
        "formatted_net_local": currency_service.format_currency(net_local, target_curr),
    }


def estimate_payout(
    hours_per_day: float,
    hourly_rate_usd: float,
    target_currency: str = "USD",
    seller_tier: str = "free"
) -> Dict[str, Any]:
    """Estimate daily, weekly, and monthly host payouts based on expected uptime and GPU tier."""
    hours_per_day = min(24.0, max(0.0, float(hours_per_day)))
    hourly_rate_usd = max(0.0, float(hourly_rate_usd))
    comm_rate = get_commission_rate(seller_tier)
    target_curr = target_currency.upper()

    daily_gross_usd = hours_per_day * hourly_rate_usd
    daily_net_usd = daily_gross_usd * (1.0 - comm_rate)

    weekly_net_usd = daily_net_usd * 7.0
    monthly_net_usd = daily_net_usd * 30.0

    return {
        "hours_per_day": hours_per_day,
        "hourly_rate_usd": hourly_rate_usd,
        "seller_tier": seller_tier,
        "commission_rate": comm_rate,
        "target_currency": target_curr,
        "daily": {
            "net_usd": round(daily_net_usd, 2),
            "net_local": currency_service.convert(daily_net_usd, "USD", target_curr),
            "formatted": currency_service.format_currency(currency_service.convert(daily_net_usd, "USD", target_curr), target_curr),
        },
        "weekly": {
            "net_usd": round(weekly_net_usd, 2),
            "net_local": currency_service.convert(weekly_net_usd, "USD", target_curr),
            "formatted": currency_service.format_currency(currency_service.convert(weekly_net_usd, "USD", target_curr), target_curr),
        },
        "monthly": {
            "net_usd": round(monthly_net_usd, 2),
            "net_local": currency_service.convert(monthly_net_usd, "USD", target_curr),
            "formatted": currency_service.format_currency(currency_service.convert(monthly_net_usd, "USD", target_curr), target_curr),
        }
    }
