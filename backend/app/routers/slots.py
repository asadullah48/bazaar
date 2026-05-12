import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_admin
from app.core.redis import get_redis
from app.models.campaign import Campaign, SlotEvent
from app.models.catalog import Product, ProductImage, ProductVariant
from app.models.user import User

router = APIRouter(prefix="/v1/slots", tags=["slots"])

SLOT_TTL = 300  # 5 minutes
VALID_SLOTS = {"hero", "deals", "trending", "flash", "recs"}


def _min_price_sq():
    return (
        select(
            ProductVariant.product_id,
            func.min(ProductVariant.price).label("min_price"),
            func.max(ProductVariant.sale_price).label("max_sale_price"),
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


async def _build_slot(slot_name: str, db: AsyncSession) -> list[dict[str, Any]]:
    mp = _min_price_sq()
    img = _first_image_sq()

    if slot_name == "recs":
        return []

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if slot_name in ("hero", "editorial"):
        rows = await db.execute(
            select(Campaign)
            .where(Campaign.is_active == True)  # noqa: E712
            .where(Campaign.start_at <= now)
            .where(Campaign.end_at >= now)
            .order_by(Campaign.start_at.desc())
            .limit(5)
        )
        campaigns = rows.scalars().all()
        return [
            {
                "id": str(c.id),
                "type": "campaign",
                "title": c.title,
                "slug": c.slug,
                "banner_url": c.banner_url,
                "discount_pct": c.discount_pct,
                "end_at": c.end_at.isoformat(),
            }
            for c in campaigns
        ]

    if slot_name == "flash":
        rows = await db.execute(
            select(Campaign)
            .where(Campaign.is_active == True)  # noqa: E712
            .where(Campaign.type == "flash_sale")
            .where(Campaign.discount_pct > 0)
            .where(Campaign.start_at <= now)
            .where(Campaign.end_at >= now)
            .limit(6)
        )
        campaigns = rows.scalars().all()
        return [
            {
                "id": str(c.id),
                "type": "campaign",
                "title": c.title,
                "slug": c.slug,
                "banner_url": c.banner_url,
                "discount_pct": c.discount_pct,
                "end_at": c.end_at.isoformat(),
            }
            for c in campaigns
        ]

    if slot_name == "deals":
        rows = await db.execute(
            select(Product, mp.c.min_price, mp.c.max_sale_price, img.c.image_url)
            .join(mp, mp.c.product_id == Product.id)
            .outerjoin(img, img.c.product_id == Product.id)
            .where(Product.status == "active")
            .where(mp.c.max_sale_price != None)  # noqa: E711
            .where(mp.c.max_sale_price < mp.c.min_price)
            .order_by((mp.c.min_price - mp.c.max_sale_price).desc())
            .limit(12)
        )
        return _rows_to_product_items(rows.all())

    if slot_name == "trending":
        scored_rows = await db.execute(
            select(Product, mp.c.min_price, img.c.image_url, func.sum(SlotEvent.score).label("total_score"))
            .join(mp, mp.c.product_id == Product.id)
            .outerjoin(img, img.c.product_id == Product.id)
            .outerjoin(SlotEvent, SlotEvent.product_id == Product.id)
            .where(Product.status == "active")
            .group_by(Product.id, mp.c.min_price, img.c.image_url)
            .order_by(func.sum(SlotEvent.score).desc().nullslast(), Product.view_count.desc())
            .limit(12)
        )
        return _rows_to_product_items_simple(scored_rows.all())

    return []


def _rows_to_product_items(rows) -> list[dict]:
    items = []
    for row in rows:
        p = row.Product
        items.append({
            "id": str(p.id),
            "type": "product",
            "title": p.title,
            "slug": p.slug,
            "price": float(row.min_price) if row.min_price is not None else None,
            "sale_price": float(row.max_sale_price) if row.max_sale_price is not None else None,
            "image_url": row.image_url,
        })
    return items


def _rows_to_product_items_simple(rows) -> list[dict]:
    items = []
    for row in rows:
        p = row.Product
        items.append({
            "id": str(p.id),
            "type": "product",
            "title": p.title,
            "slug": p.slug,
            "price": float(row.min_price) if row.min_price is not None else None,
            "image_url": row.image_url,
        })
    return items


@router.get("/{slot_name}")
async def get_slot(slot_name: str, db: AsyncSession = Depends(get_db)):
    if slot_name not in VALID_SLOTS:
        raise HTTPException(status_code=404, detail=f"Unknown slot '{slot_name}'")

    redis = await get_redis()
    cache_key = f"slot:{slot_name}"
    cached = await redis.get(cache_key)
    if cached:
        return {"slot": slot_name, "items": json.loads(cached), "cached": True}

    items = await _build_slot(slot_name, db)
    await redis.setex(cache_key, SLOT_TTL, json.dumps(items))
    return {"slot": slot_name, "items": items, "cached": False}


@router.post("/{slot_name}/invalidate", status_code=204)
async def invalidate_slot(
    slot_name: str,
    _admin: User = Depends(require_admin),
):
    if slot_name not in VALID_SLOTS:
        raise HTTPException(status_code=404, detail=f"Unknown slot '{slot_name}'")
    redis = await get_redis()
    await redis.delete(f"slot:{slot_name}")
