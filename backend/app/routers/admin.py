import math
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.catalog import Product
from app.models.user import SellerProfile, User
from app.schemas.admin import (
    AdminPaginatedProducts,
    AdminPaginatedSellers,
    AdminProductDetail,
    AdminProductListItem,
    AdminSellerItem,
    RejectPayload,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@router.get("/products", response_model=AdminPaginatedProducts)
async def list_admin_products(
    status: str = Query("under_review"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    count_q = select(func.count(Product.id)).where(Product.status == status)
    total: int = (await db.execute(count_q)).scalar() or 0

    rows = (
        await db.execute(
            select(Product, User.email, SellerProfile.store_name)
            .join(User, Product.seller_id == User.id)
            .outerjoin(SellerProfile, SellerProfile.user_id == User.id)
            .where(Product.status == status)
            .order_by(Product.created_at.asc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    ).all()

    items = [
        {
            "id": row.Product.id,
            "title": row.Product.title,
            "status": row.Product.status,
            "seller_id": row.Product.seller_id,
            "seller_store_name": row.store_name,
            "seller_email": row.email,
            "created_at": row.Product.created_at,
        }
        for row in rows
    ]

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if total else 0,
    }


@router.put("/products/{product_id}/approve", response_model=AdminProductDetail)
async def approve_product(
    product_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    product.status = "published"
    await db.commit()
    await db.refresh(product)
    return product


@router.put("/products/{product_id}/reject", response_model=AdminProductDetail)
async def reject_product(
    product_id: uuid.UUID,
    payload: RejectPayload,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    product.status = "draft"
    product.rejection_reason = payload.reason
    await db.commit()
    await db.refresh(product)
    return product


@router.get("/sellers", response_model=AdminPaginatedSellers)
async def list_admin_sellers(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    conditions = []
    if status:
        conditions.append(SellerProfile.status == status)

    count_q = select(func.count(SellerProfile.id))
    if conditions:
        count_q = count_q.where(*conditions)
    total: int = (await db.execute(count_q)).scalar() or 0

    data_q = (
        select(SellerProfile, User.email)
        .join(User, SellerProfile.user_id == User.id)
        .order_by(SellerProfile.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    if conditions:
        data_q = data_q.where(*conditions)

    rows = (await db.execute(data_q)).all()
    items = [
        {
            "id": row.SellerProfile.user_id,
            "store_name": row.SellerProfile.store_name,
            "email": row.email,
            "status": row.SellerProfile.status,
            "created_at": row.SellerProfile.created_at,
        }
        for row in rows
    ]

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if total else 0,
    }


@router.put("/sellers/{user_id}/approve", response_model=AdminSellerItem)
async def approve_seller(
    user_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SellerProfile, User.email)
        .join(User, SellerProfile.user_id == User.id)
        .where(SellerProfile.user_id == user_id)
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Seller not found")
    sp, email = row.SellerProfile, row.email
    sp.status = "approved"
    sp.approved_at = _utcnow()
    await db.commit()
    await db.refresh(sp)
    return {
        "id": sp.user_id,
        "store_name": sp.store_name,
        "email": email,
        "status": sp.status,
        "created_at": sp.created_at,
    }


@router.put("/sellers/{user_id}/suspend", response_model=AdminSellerItem)
async def suspend_seller(
    user_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SellerProfile, User.email)
        .join(User, SellerProfile.user_id == User.id)
        .where(SellerProfile.user_id == user_id)
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Seller not found")
    sp, email = row.SellerProfile, row.email
    sp.status = "suspended"
    await db.commit()
    await db.refresh(sp)
    return {
        "id": sp.user_id,
        "store_name": sp.store_name,
        "email": email,
        "status": sp.status,
        "created_at": sp.created_at,
    }
