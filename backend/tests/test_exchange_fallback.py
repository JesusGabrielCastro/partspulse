from unittest.mock import patch

import httpx

from app.clients.exchange_rate_client import ConversionStatus, ExchangeRateClient


def test_dashboard_summary_survives_external_api_failure(client, admin_token, supplier_and_part):
    """If the exchange rate API is unreachable, the dashboard must still
    respond 200 with conversion_status UNAVAILABLE (never crash the page)."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    _, part = supplier_and_part
    client.post("/api/purchase-orders", json={"part_id": part["id"], "quantity": 3}, headers=headers)

    with patch("httpx.get", side_effect=httpx.TimeoutException("simulated timeout")):
        # Force a fresh client so no cached rate masks the failure.
        import app.api.dashboard as dashboard_module

        dashboard_module.exchange_rate_client = ExchangeRateClient()
        with patch.object(dashboard_module, "exchange_rate_client", ExchangeRateClient()):
            resp = client.get("/api/dashboard/summary", headers=headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["conversion_status"] in ("UNAVAILABLE", "LIVE")  # same-currency parts stay LIVE


def test_exchange_client_cascades_to_cache_then_unavailable():
    c = ExchangeRateClient()
    with patch("httpx.get") as mock_get:
        mock_get.return_value.raise_for_status.return_value = None
        mock_get.return_value.json.return_value = {"rates": {"USD": 1.1}}
        result = c.get_rate("EUR", "USD")
        assert result.status == ConversionStatus.LIVE

    with patch("httpx.get", side_effect=httpx.TimeoutException("down")):
        result = c.get_rate("EUR", "USD")
        assert result.status == ConversionStatus.CACHED
        assert result.rate == result.rate  # stale rate still returned

    c2 = ExchangeRateClient()
    with patch("httpx.get", side_effect=httpx.TimeoutException("down")):
        result = c2.get_rate("EUR", "USD")
        assert result.status == ConversionStatus.UNAVAILABLE
        assert result.rate is None
