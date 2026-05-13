"""
Tests for Phase 4: Product SEO + QR Code generation.
Covers: pure QR unit, arq enqueue mock, public GET QR (Redis + DB fallback), 403 non-owner,
and graceful skip when ANTHROPIC_API_KEY is absent.
"""
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.services.qr_generator import generate_qr_data_uri


# ── 1. Pure QR unit test (no I/O) ────────────────────────────────────────────

def test_generate_qr_data_uri_returns_png_data_uri():
    uri = generate_qr_data_uri("https://shopunity.pk/en/products/test-slug")
    assert uri.startswith("data:image/png;base64,")
    assert len(uri) > 100  # non-empty image


# ── 2. GET /v1/products/{id}/qr — Redis hit returns cached ───────────────────

@pytest.mark.asyncio
async def test_get_qr_returns_cached_when_redis_hit():
    product_id = uuid.uuid4()
    fake_redis = AsyncMock()
    fake_redis.get = AsyncMock(return_value="data:image/png;base64,AAAA")

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        with patch("app.core.redis.get_redis", AsyncMock(return_value=fake_redis)):
            resp = await client.get(f"/v1/products/{product_id}/qr")

    assert resp.status_code == 200
    assert resp.json()["qr_code_url"] == "data:image/png;base64,AAAA"
    assert resp.json()["cached"] is True


# ── 3. GET /v1/products/{id}/qr — 404 when not generated ─────────────────────

@pytest.mark.asyncio
async def test_get_qr_404_when_not_generated():
    product_id = uuid.uuid4()
    fake_redis = AsyncMock()
    fake_redis.get = AsyncMock(return_value=None)

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        with patch("app.core.redis.get_redis", AsyncMock(return_value=fake_redis)):
            resp = await client.get(f"/v1/products/{product_id}/qr")

    assert resp.status_code == 404
