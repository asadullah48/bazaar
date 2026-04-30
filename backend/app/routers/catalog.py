import math
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.catalog import Product, ProductB2BTier, ProductVariant
from app.models.user import SellerProfile
from app.schemas.product import (
    B2BTierResponse,
    CatalogListItem,
    CatalogProductDetail,
    PaginatedCatalog,
    SellerStorefrontResponse,
    VariantResponse,
)

router = APIRouter(tags=["catalog"])


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


@router.get("/products", response_model=PaginatedCatalog)
async def list_products(
    category_id: Optional[uuid.UUID] = Query(None),
    brand: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    condition: Optional[str] = Query(None),
    is_b2b: Optional[bool] = Query(None),
    availability: Optional[str] = Query(None),
    sort: str = Query("newest"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    mp_sq = _min_price_sq()

    base_conditions = [Product.status == "published"]
    if category_id is not None:
        base_conditions.append(Product.category_id == category_id)
    if brand is not None:
        base_conditions.append(Product.brand.ilike(f"%{brand}%"))
    if condition is not None:
        base_conditions.append(Product.condition == condition)
    if is_b2b is not None:
        base_conditions.append(Product.is_b2b_eligible == is_b2b)
    if min_price is not None:
        base_conditions.append(mp_sq.c.min_price >= min_price)
    if max_price is not None:
        base_conditions.append(mp_sq.c.min_price <= max_price)
    if availability == "in_stock":
        in_stock_sub = (
            select(ProductVariant.product_id)
            .where(ProductVariant.is_active == True, ProductVariant.stock_qty > 0)
            .distinct()
            .subquery()
        )
        base_conditions.append(Product.id.in_(select(in_stock_sub.c.product_id)))

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
    elif sort == "top_rated":
        data_q = data_q.order_by(Product.view_count.desc())
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


@router.get("/products/{product_id}", response_model=CatalogProductDetail)
async def get_product(product_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.status == "published")
    )
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    variants_result = await db.execute(
        select(ProductVariant).where(
            ProductVariant.product_id == product.id,
            ProductVariant.is_active == True,
        )
    )
    variants = variants_result.scalars().all()

    tiers = []
    if product.is_b2b_eligible:
        tiers_result = await db.execute(
            select(ProductB2BTier)
            .where(ProductB2BTier.product_id == product.id)
            .order_by(ProductB2BTier.sort_order)
        )
        tiers = tiers_result.scalars().all()

    return {
        "id": product.id,
        "seller_id": product.seller_id,
        "title": product.title,
        "slug": product.slug,
        "description": product.description,
        "brand": product.brand,
        "condition": product.condition,
        "category_id": product.category_id,
        "tags": product.tags,
        "attributes": product.attributes,
        "is_b2b_eligible": product.is_b2b_eligible,
        "b2b_moq": product.b2b_moq,
        "status": product.status,
        "created_at": product.created_at,
        "variants": [VariantResponse.model_validate(v) for v in variants],
        "b2b_tiers": [B2BTierResponse.model_validate(t) for t in tiers],
    }


@router.get("/sellers/{slug}", response_model=SellerStorefrontResponse)
async def seller_storefront(
    slug: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    sp_result = await db.execute(
        select(SellerProfile).where(
            SellerProfile.store_slug == slug,
            SellerProfile.status == "approved",
        )
    )
    sp = sp_result.scalar_one_or_none()
    if sp is None:
        raise HTTPException(status_code=404, detail="Seller not found")

    mp_sq = _min_price_sq()

    total: int = (
        await db.execute(
            select(func.count(Product.id)).where(
                Product.seller_id == sp.user_id,
                Product.status == "published",
            )
        )
    ).scalar() or 0

    rows = (
        await db.execute(
            select(Product, mp_sq.c.min_price)
            .outerjoin(mp_sq, Product.id == mp_sq.c.product_id)
            .where(Product.seller_id == sp.user_id, Product.status == "published")
            .order_by(Product.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    ).all()

    return {
        "store_name": sp.store_name,
        "description": sp.description,
        "city": sp.city,
        "total_rating": float(sp.total_rating),
        "review_count": sp.review_count,
        "approved_at": sp.approved_at,
        "products": {
            "items": [_row_to_item(r) for r in rows],
            "total": total,
            "page": page,
            "pages": math.ceil(total / limit) if total else 0,
        },
    }
