import hashlib
import json

from anthropic import AsyncAnthropic

from app.core.config import get_settings
from app.core.redis import get_redis
from app.models.catalog import Product

SEO_TTL = 86400


async def generate_product_seo(product: Product) -> dict:
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise ValueError("Anthropic API key not configured")

    product_str = f"{product.title}|{product.description or ''}|{product.updated_at}"
    content_hash = hashlib.md5(product_str.encode()).hexdigest()
    cache_key = f"seo:{product.id}:{content_hash}"

    redis = await get_redis()
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    base = f"{settings.base_url}/en/products/{product.slug}"
    hreflang = {
        "en": base,
        "ar": f"{settings.base_url}/ar/products/{product.slug}",
        "ur": f"{settings.base_url}/ur/products/{product.slug}",
    }

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    prompt = (
        f"Generate SEO data for this product as a JSON object only (no markdown, "
        f"no explanation).\n"
        f"Product: {product.title}\n"
        f"Description: {product.description or 'No description'}\n\n"
        f'Return exactly this structure:\n'
        f'{{\n'
        f'  "title": "SEO title max 60 chars",\n'
        f'  "meta_description": "Compelling description max 160 chars",\n'
        f'  "keywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],\n'
        f'  "json_ld": {{\n'
        f'    "@context": "https://schema.org",\n'
        f'    "@type": "Product",\n'
        f'    "name": "product name",\n'
        f'    "description": "product description"\n'
        f'  }}\n'
        f'}}'
    )

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    seo_data = json.loads(raw)
    seo_data["hreflang"] = hreflang

    await redis.setex(cache_key, SEO_TTL, json.dumps(seo_data))
    return seo_data
