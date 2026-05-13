import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import get_redis
from app.models.catalog import Product, ProductImage, ProductVariant

router = APIRouter(prefix="/v1/recommendations", tags=["recommendations"])

RECS_TTL = 600  # 10 minutes editorial cache; ML recs have their own 24h TTL


def _min_price_sq():
    return (
        select(
            ProductVariant.product_id,
            func.min(ProductVariant.price).label("min_price"),
        )
        .where(ProductVariant.is_active == True)  # noqa: E712
        .group_by(ProductVariant.product_id)
        .subquery()
    )


def _first_image_sq():
    return (
        select(
            ProductImage.product_id,
            func.min(ProductImage.url).label("image_url"),
        )
        .group_by(ProductImage.product_id)
        .subquery()
    )


@router.get("")
async def get_recommendations(
    product_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    redis = await get_redis()

    # Try ML-computed co-occurrence recs first (written by nightly batch job)
    if product_id:
        ml_raw = await redis.get(f"ml_recs:{product_id}")
        if ml_raw:
            scored = json.loads(ml_raw)
            pids = [uuid.UUID(s["id"]) for s in scored]
            if pids:
                mp = _min_price_sq()
                img = _first_image_sq()
                rows = await db.execute(
                    select(Product, mp.c.min_price, img.c.image_url)
                    .join(mp, mp.c.product_id == Product.id)
                    .outerjoin(img, img.c.product_id == Product.id)
                    .where(Product.status == "active", Product.id.in_(pids))
                )
                score_map = {s["id"]: s["score"] for s in scored}
                items = _rows_to_items(rows.all())
                items.sort(key=lambda x: score_map.get(x["id"], 0), reverse=True)
                return {"items": items, "source": "ml", "cached": False}

    # Editorial fallback: cache-backed category/global recs
    cache_key = f"recs:{product_id or 'global'}"
    cached = await redis.get(cache_key)
    if cached:
        data = json.loads(cached)
        return {"items": data["items"], "source": data["source"], "cached": True}

    mp = _min_price_sq()
    img = _first_image_sq()
    source = "global"

    if product_id:
        prod_result = await db.execute(select(Product).where(Product.id == product_id))
        product = prod_result.scalar_one_or_none()
        if product and product.category_id:
            source = "category"
            rows = await db.execute(
                select(Product, mp.c.min_price, img.c.image_url)
                .join(mp, mp.c.product_id == Product.id)
                .outerjoin(img, img.c.product_id == Product.id)
                .where(Product.status == "active")
                .where(Product.category_id == product.category_id)
                .where(Product.id != product_id)
                .order_by(Product.view_count.desc())
                .limit(8)
            )
            items = _rows_to_items(rows.all())
        else:
            items = await _global_recs(db, mp, img)
    else:
        items = await _global_recs(db, mp, img)

    payload = {"items": items, "source": source}
    await redis.setex(cache_key, RECS_TTL, json.dumps(payload))
    return {"items": items, "source": source, "cached": False}


async def _global_recs(db, mp, img) -> list[dict]:
    rows = await db.execute(
        select(Product, mp.c.min_price, img.c.image_url)
        .join(mp, mp.c.product_id == Product.id)
        .outerjoin(img, img.c.product_id == Product.id)
        .where(Product.status == "active")
        .order_by(Product.view_count.desc())
        .limit(8)
    )
    return _rows_to_items(rows.all())


def _rows_to_items(rows) -> list[dict]:
    items = []
    for row in rows:
        p = row.Product
        items.append({
            "id": str(p.id),
            "title": p.title,
            "slug": p.slug,
            "price": float(row.min_price) if row.min_price is not None else None,
            "image_url": row.image_url,
        })
    return items
