"""Pricing and financial calculations for Productify Gamezone."""

from typing import Dict, Any, Optional
from currency_engine.forex import currency_service, SUPPORTED_CURRENCIES

PLATFORM_FEE_PERCENT = 0.10  # 10% platform orchestration fee
TAX_PERCENT = 0.05           # 5% infrastructure and sales tax


def calculate_private_game_pricing(
    gpu_base_hourly_rate: float,
    target_currency: str = "USD"
) -> Dict[str, Any]:
    """Calculate transparent pricing breakdown for running a private uploaded game.
    
    Formula:
      - GPU Base Rental Rate: $X.XX/hr
      - Platform Fee: 10%
      - Taxes & Infrastructure: 5%
      - Total Hourly Rate = GPU Rate * 1.15
    """
    gpu_rate = max(0.10, float(gpu_base_hourly_rate))
    platform_fee = round(gpu_rate * PLATFORM_FEE_PERCENT, 4)
    tax_amount = round(gpu_rate * TAX_PERCENT, 4)
    total_hourly_usd = round(gpu_rate + platform_fee + tax_amount, 4)

    curr = target_currency.upper()
    if curr not in SUPPORTED_CURRENCIES:
        curr = "USD"

    total_local = currency_service.convert(total_hourly_usd, "USD", curr)
    gpu_local = currency_service.convert(gpu_rate, "USD", curr)
    fee_local = currency_service.convert(platform_fee, "USD", curr)
    tax_local = currency_service.convert(tax_amount, "USD", curr)

    return {
        "currency": curr,
        "gpu_base_rate_usd": round(gpu_rate, 2),
        "platform_fee_percent": int(PLATFORM_FEE_PERCENT * 100),
        "platform_fee_usd": round(platform_fee, 2),
        "tax_percent": int(TAX_PERCENT * 100),
        "tax_usd": round(tax_amount, 2),
        "total_hourly_usd": round(total_hourly_usd, 2),
        "total_hourly_credits": round(total_hourly_usd, 2),
        # Converted local displays
        "gpu_base_local": gpu_local,
        "platform_fee_local": fee_local,
        "tax_local": tax_local,
        "total_hourly_local": total_local,
        "formatted_total_local": currency_service.format_currency(total_local, curr),
        "formatted_breakdown": f"GPU: {currency_service.format_currency(gpu_local, curr)} + Platform (10%): {currency_service.format_currency(fee_local, curr)} + Tax (5%): {currency_service.format_currency(tax_local, curr)}"
    }


def calculate_session_metered_cost(
    hourly_rate_credits: float,
    runtime_seconds: float
) -> Dict[str, Any]:
    """Calculate exact metered cost for elapsed playtime."""
    seconds = max(0.0, float(runtime_seconds))
    rate = max(0.0, float(hourly_rate_credits))
    hours = seconds / 3600.0
    cost_credits = round(hours * rate, 4)

    return {
        "runtime_seconds": round(seconds, 1),
        "runtime_hours": round(hours, 4),
        "hourly_rate_credits": rate,
        "cost_credits": cost_credits,
        "formatted_cost": f"${cost_credits:.2f}"
    }
