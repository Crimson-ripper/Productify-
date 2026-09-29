"""Foreign Exchange (Forex) Synchronization & Multi-Currency Engine for Productify.

Maintains live exchange rates against base currency (USD), caches rates in MongoDB,
and provides multi-currency conversion and localized financial formatting.
"""

import time
import json
import logging
import asyncio
import urllib.request
from typing import Dict, Any, Optional
from datetime import datetime, timezone

try:
    import httpx
except ImportError:
    httpx = None

logger = logging.getLogger("productify.forex")

BASE_CURRENCY = "USD"

SUPPORTED_CURRENCIES = {
    "USD": {"symbol": "$", "name": "US Dollar", "decimals": 2},
    "EUR": {"symbol": "€", "name": "Euro", "decimals": 2},
    "GBP": {"symbol": "£", "name": "British Pound", "decimals": 2},
    "INR": {"symbol": "₹", "name": "Indian Rupee", "decimals": 2},
    "CAD": {"symbol": "CA$", "name": "Canadian Dollar", "decimals": 2},
    "AUD": {"symbol": "AU$", "name": "Australian Dollar", "decimals": 2},
    "JPY": {"symbol": "¥", "name": "Japanese Yen", "decimals": 0},
}

# Reliable fallback rates in case external exchange API is unreachable
FALLBACK_RATES = {
    "USD": 1.0,
    "EUR": 0.92,
    "GBP": 0.78,
    "INR": 83.50,
    "CAD": 1.36,
    "AUD": 1.52,
    "JPY": 155.0,
}


class CurrencySyncService:
    """Manages live exchange rate synchronization, memory caching, and currency conversion."""

    def __init__(self, cache_ttl_seconds: float = 21600.0):  # 6-hour refresh TTL
        self.cache_ttl_seconds = cache_ttl_seconds
        self.rates: Dict[str, float] = dict(FALLBACK_RATES)
        self.last_sync_time: float = 0.0
        self.last_sync_iso: Optional[str] = None
        self.db = None

    def set_db(self, database):
        self.db = database

    async def initialize(self):
        """Load cached rates from MongoDB on startup or fetch fresh rates."""
        if self.db is not None:
            try:
                doc = await self.db.forex_rates.find_one({"base": BASE_CURRENCY}, {"_id": 0})
                if doc and "rates" in doc:
                    self.rates = doc["rates"]
                    self.last_sync_iso = doc.get("updated_at")
                    self.last_sync_time = doc.get("sync_timestamp", time.time())
                    logger.info("Loaded cached forex rates from database.")
            except Exception as e:
                logger.warning(f"Could not load forex rates from db: {e}")

        # If rates are stale or not initialized, sync immediately
        if (time.time() - self.last_sync_time) > self.cache_ttl_seconds:
            await self.sync_rates()

    async def sync_rates(self) -> Dict[str, Any]:
        """Fetch fresh live foreign exchange rates from open exchange API."""
        url = "https://open.er-api.com/v6/latest/USD"
        data = None
        try:
            if httpx is not None:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    res = await client.get(url)
                    if res.status_code == 200:
                        data = res.json()
            else:
                def _do_fetch():
                    req = urllib.request.Request(url, headers={"User-Agent": "Productify-Forex-Engine/1.0"})
                    with urllib.request.urlopen(req, timeout=8.0) as resp:
                        return json.loads(resp.read().decode("utf-8"))
                data = await asyncio.to_thread(_do_fetch)

            if data and "rates" in data:
                raw_rates = data.get("rates", {})
                updated = {}
                for curr in SUPPORTED_CURRENCIES.keys():
                    if curr in raw_rates:
                        updated[curr] = float(raw_rates[curr])
                    else:
                        updated[curr] = self.rates.get(curr, FALLBACK_RATES.get(curr, 1.0))

                self.rates = updated
                self.last_sync_time = time.time()
                self.last_sync_iso = datetime.now(timezone.utc).isoformat()
                logger.info(f"Successfully synchronized forex rates (INR={self.rates.get('INR')}, EUR={self.rates.get('EUR')})")

                # Persist to MongoDB
                if self.db is not None:
                    await self.db.forex_rates.update_one(
                        {"base": BASE_CURRENCY},
                        {"$set": {
                            "base": BASE_CURRENCY,
                            "rates": self.rates,
                            "updated_at": self.last_sync_iso,
                            "sync_timestamp": self.last_sync_time,
                            "provider": "open.er-api.com",
                        }},
                        upsert=True
                    )
                return {"ok": True, "rates": self.rates, "updated_at": self.last_sync_iso}
        except Exception as e:
            logger.warning(f"Error syncing forex rates from API ({e}), using current cached rates.")

        return {"ok": False, "rates": self.rates, "updated_at": self.last_sync_iso, "warning": "using_cached_rates"}

    def convert(self, amount: float, from_curr: str = "USD", to_curr: str = "USD") -> float:
        """Convert an amount from one currency to another using current rates."""
        from_curr = from_curr.upper()
        to_curr = to_curr.upper()

        if from_curr == to_curr:
            return round(amount, 4)

        # Convert to USD base first
        from_rate = self.rates.get(from_curr, 1.0)
        amount_usd = amount / from_rate if from_rate else amount

        # Convert from USD to target currency
        to_rate = self.rates.get(to_curr, 1.0)
        converted = amount_usd * to_rate

        decimals = SUPPORTED_CURRENCIES.get(to_curr, {}).get("decimals", 2)
        return round(converted, decimals)

    def format_currency(self, amount: float, currency: str = "USD") -> str:
        """Format amount with currency symbol and precision (e.g. '$12.50' or '₹1,043.75')."""
        currency = currency.upper()
        meta = SUPPORTED_CURRENCIES.get(currency, {"symbol": "$", "decimals": 2})
        decimals = meta["decimals"]
        formatted_num = f"{amount:,.{decimals}f}"
        return f"{meta['symbol']}{formatted_num}"

    def get_supported_currencies_meta(self) -> Dict[str, Any]:
        """Return list of supported currencies with exchange rates and formatting rules."""
        result = {}
        for code, meta in SUPPORTED_CURRENCIES.items():
            result[code] = {
                "code": code,
                "name": meta["name"],
                "symbol": meta["symbol"],
                "rate_against_usd": self.rates.get(code, 1.0),
            }
        return {
            "base_currency": BASE_CURRENCY,
            "updated_at": self.last_sync_iso,
            "currencies": result
        }


currency_service = CurrencySyncService()
