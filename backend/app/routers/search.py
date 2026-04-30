import math
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Text, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.catalog import Product, ProductVariant
from app.schemas.product import PaginatedCatalog

router = APIRouter(tags=["search"])


def _min_price_sq():
    return (
        select(
            ProductVariant.product_id,
            func.min(ProductVariant.price).label("min_price"),
        )
        .where(ProductVariant.is_active == True)
        .group_by(ProductVariant.product_id)
        .subquery()
    )


def _row_to_item(row) -> dict:
    p = row.Product
    mp = row.min_price
    return {
        "id": p.id,
        "title": p.title,
        "slug": p.slug,
        "brand": p.brand,
        "condition": p.condition,
        "category_id": p.category_id,
        "seller_id": p.seller_id,
        "min_price": float(mp) if mp is not None else None,
        "is_b2b_eligible": p.is_b2b_eligible,
        "created_at": p.created_at,
    }


@router.get("/search", response_model=PaginatedCatalog)
async def search_products(
    q: str = Query(...),
    category_id: Optional[uuid.UUID] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    condition: Optional[str] = Query(None),
    is_b2b: Optional[bool] = Query(None),
    sort: str = Query("newest"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    if not q or not q.strip():
        raise HTTPException(status_code=400, detail="Search query required")

    term = f"%{q.strip()}%"
    mp_sq = _min_price_sq()

    search_filter = or_(
        Product.title.ilike(term),
        Product.brand.ilike(term),
        cast(Product.tags, Text).ilike(term),
    )

    base_conditions = [Product.status == "published", search_filter]

    if category_id is not None:
        base_conditions.append(Product.category_id == category_id)
    if condition is not None:
        base_conditions.append(Product.condition == condition)
    if is_b2b is not None:
        base_conditions.append(Product.is_b2b_eligible == is_b2b)
    if min_price is not None:
        base_conditions.append(mp_sq.c.min_price >= min_price)
    if max_price is not None:
        base_conditions.append(mp_sq.c.min_price <= max_price)

    count_q = (
        select(func.count(Product.id))
        .outerjoin(mp_sq, Product.id == mp_sq.c.product_id)
        .where(*base_conditions)
    )
    total: int = (await db.execute(count_q)).scalar() or 0

    data_q = (
        select(Product, mp_sq.c.min_price)
        .outerjoin(mp_sq, Product.id == mp_sq.c.product_id)
        .where(*base_conditions)
    )

    if sort == "price_asc":
        data_q = data_q.order_by(mp_sq.c.min_price.asc().nulls_last())
    elif sort == "price_desc":
        data_q = data_q.order_by(mp_sq.c.min_price.desc().nulls_last())
    else:
        data_q = data_q.order_by(Product.created_at.desc())

    data_q = data_q.offset((page - 1) * limit).limit(limit)
    rows = (await db.execute(data_q)).all()

    return {
        "items": [_row_to_item(r) for r in rows],
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if total else 0,
    }


@router.get("/search/suggestions")
async def search_suggestions(
    q: str = Query(..., min_length=2),
    db: AsyncSession = Depends(get_db),
):
    term = f"%{q.strip()}%"
    rows = (
        await db.execute(
            select(Product.title)
            .where(Product.status == "published", Product.title.ilike(term))
            .distinct()
            .order_by(Product.title)
            .limit(5)
        )
    ).scalars().all()
    return {"suggestions": list(rows)}
