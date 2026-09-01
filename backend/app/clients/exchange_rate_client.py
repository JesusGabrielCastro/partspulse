"""Isolated HTTP client for the Frankfurter exchange-rate API.

No raw response ever leaves this module: callers get a Decimal rate plus a
status enum. This keeps route handlers and services free of any knowledge
of the external API's shape (see docs/architecture.md, Q14).
"""
import enum
import logging
import time
from decimal import Decimal, InvalidOperation

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


class ConversionStatus(str, enum.Enum):
    LIVE = "LIVE"
    CACHED = "CACHED"
    UNAVAILABLE = "UNAVAILABLE"


class RateResult:
    def __init__(self, rate: Decimal | None, status: ConversionStatus, updated_at: float | None):
        self.rate = rate
        self.status = status
        self.updated_at = updated_at


class _CacheEntry:
    __slots__ = ("rate", "fetched_at")

    def __init__(self, rate: Decimal, fetched_at: float):
        self.rate = rate
        self.fetched_at = fetched_at


class ExchangeRateClient:
    """In-memory TTL cache + cascading fallback: live -> stale cache -> unavailable."""

    def __init__(self) -> None:
        self._cache: dict[tuple[str, str], _CacheEntry] = {}

    def get_rate(self, base: str, quote: str) -> RateResult:
        base, quote = base.upper(), quote.upper()
        if base == quote:
            return RateResult(Decimal("1"), ConversionStatus.LIVE, time.time())

        key = (base, quote)
        cached = self._cache.get(key)

        if cached is not None and (time.time() - cached.fetched_at) < settings.exchange_cache_ttl_seconds:
            logger.debug("Exchange rate cache hit: %s -> %s", base, quote)
            return RateResult(cached.rate, ConversionStatus.CACHED, cached.fetched_at)

        try:
            rate = self._fetch(base, quote)
            self._cache[key] = _CacheEntry(rate, time.time())
            logger.info("Exchange rate fetched live: %s -> %s", base, quote)
            return RateResult(rate, ConversionStatus.LIVE, time.time())
        except (httpx.HTTPError, InvalidOperation, KeyError, ValueError) as exc:
            logger.warning("Exchange rate fetch failed for %s -> %s: %s", base, quote, exc)
            if cached is not None:
                return RateResult(cached.rate, ConversionStatus.CACHED, cached.fetched_at)
            return RateResult(None, ConversionStatus.UNAVAILABLE, None)

    def _fetch(self, base: str, quote: str) -> Decimal:
        url = f"{settings.exchange_api_base_url}/latest"
        resp = httpx.get(
            url,
            params={"base": base, "symbols": quote},
            timeout=settings.exchange_api_timeout_seconds,
            follow_redirects=True,
        )
        resp.raise_for_status()
        data = resp.json()
        return Decimal(str(data["rates"][quote]))


exchange_rate_client = ExchangeRateClient()
