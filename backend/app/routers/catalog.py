import math
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.catalog import Product, ProductB2BTier, ProductImage, ProductVariant
from app.models.user import SellerProfile
from app.schemas.product import (
    B2BTierResponse,
    CatalogListItem,
    CatalogProductDetail,
    PaginatedCatalog,
    PublicProduct,
    PublicProductImage,
    PublicProductSeller,
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


@router.get("/products/{slug}", response_model=PublicProduct)
async def get_product(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Product).where(Product.slug == slug, Product.status == "published")
    )
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    # Images
    images_result = await db.execute(
        select(ProductImage)
        .where(ProductImage.product_id == product.id)
        .order_by(ProductImage.is_primary.desc(), ProductImage.sort_order)
    )
    images = images_result.scalars().all()

    # Cheapest active variant price → product.price
    variants_result = await db.execute(
        select(ProductVariant).where(
            ProductVariant.product_id == product.id,
            ProductVariant.is_active == True,
        )
    )
    variants = variants_result.scalars().all()
    prices = [float(v.price) for v in variants if v.price is not None]
    price = min(prices) if prices else 0.0
    stock_qty = sum(v.stock_qty for v in variants)

    # Seller profile
    sp_result = await db.execute(
        select(SellerProfile).where(SellerProfile.user_id == product.seller_id)
    )
    sp = sp_result.scalar_one_or_none()

    return PublicProduct(
        id=product.id,
        name=product.title,
        slug=product.slug,
        price=price,
        compare_price=None,
        stock_qty=stock_qty,
        avg_rating=float(sp.total_rating) / sp.review_count if sp and sp.review_count else None,
        review_count=sp.review_count if sp else 0,
        is_b2b_eligible=product.is_b2b_eligible,
        images=[
            PublicProductImage(
                id=img.id,
                url=img.url,
                alt=None,
                is_primary=img.is_primary,
            )
            for img in images
        ],
        seller=PublicProductSeller(
            id=str(product.seller_id),
            display_name=sp.store_name if sp else "Unknown",
            slug=sp.store_slug if sp else "",
        ),
    )


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
