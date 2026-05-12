import hashlib

import httpx
from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.core.redis import get_redis
from app.schemas.translate import TranslateRequest, TranslateResponse

router = APIRouter(prefix="/v1/translate", tags=["translate"])

CACHE_TTL = 86400  # 24 hours


@router.post("", response_model=TranslateResponse)
async def translate_text(body: TranslateRequest):
    settings = get_settings()
    if not settings.deepl_api_key:
        raise HTTPException(503, "Translation service not configured")

    content_hash = hashlib.md5(body.text.encode()).hexdigest()
    cache_key = f"translate:{body.target_lang}:{content_hash}"

    redis = await get_redis()
    cached = await redis.get(cache_key)
    if cached:
        return TranslateResponse(translated_text=cached, cached=True)

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api-free.deepl.com/v2/translate",
            headers={"Authorization": f"DeepL-Auth-Key {settings.deepl_api_key}"},
            json={"text": [body.text], "target_lang": body.target_lang},
            timeout=10.0,
        )

    if resp.status_code != 200:
        raise HTTPException(502, "Translation service error")

    translated = resp.json()["translations"][0]["text"]
    await redis.setex(cache_key, CACHE_TTL, translated)
    return TranslateResponse(translated_text=translated, cached=False)
