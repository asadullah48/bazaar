import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, Response, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_translate_returns_503_when_key_missing():
    with patch("app.routers.translate.get_settings") as mock_settings:
        mock_settings.return_value.deepl_api_key = ""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/v1/translate", json={"text": "hello", "target_lang": "AR"})
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_translate_returns_cached_result():
    with patch("app.routers.translate.get_redis") as mock_redis_factory, \
         patch("app.routers.translate.get_settings") as mock_settings:
        mock_settings.return_value.deepl_api_key = "fake-key"
        mock_redis = AsyncMock()
        mock_redis.get.return_value = "مرحبا"
        mock_redis_factory.return_value = mock_redis
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/v1/translate", json={"text": "hello", "target_lang": "AR"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["cached"] is True
    assert data["translated_text"] == "مرحبا"


@pytest.mark.asyncio
async def test_translate_calls_deepl_on_cache_miss():
    deepl_resp = Response(200, json={"translations": [{"text": "مرحبا"}]})
    with patch("app.routers.translate.get_redis") as mock_redis_factory, \
         patch("app.routers.translate.get_settings") as mock_settings, \
         patch("app.routers.translate.httpx.AsyncClient") as mock_http_cls:
        mock_settings.return_value.deepl_api_key = "fake-key"
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None
        mock_redis_factory.return_value = mock_redis

        mock_http = AsyncMock()
        mock_http.post = AsyncMock(return_value=deepl_resp)
        mock_http_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/v1/translate", json={"text": "hello", "target_lang": "AR"})
    assert resp.status_code == 200
    assert resp.json()["cached"] is False
    assert mock_redis.setex.called


@pytest.mark.asyncio
async def test_translate_rejects_invalid_lang():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/v1/translate", json={"text": "hello", "target_lang": "ZZ"})
    assert resp.status_code == 422
