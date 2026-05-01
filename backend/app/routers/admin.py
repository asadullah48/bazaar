import math
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.catalog import Product
from app.models.order import Order
from app.models.payout import PayoutRecord
from app.models.user import SellerProfile, User
from app.schemas.admin import (
    AdminPaginatedProducts,
    AdminPaginatedSellers,
    AdminProductDetail,
    AdminProductListItem,
    AdminSellerItem,
    RejectPayload,
)
from app.schemas.payout import (
    MarkPaidRequest,
    PaginatedPayouts,
    PayoutCalculateRequest,
    PayoutRecordResponse,
)
from app.services.commission import calculate_payout

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


# ── Payout endpoints ──────────────────────────────────────────────────────────

def _payout_to_response(r: PayoutRecord) -> PayoutRecordResponse:
    return PayoutRecordResponse(
        id=r.id,
        seller_id=r.seller_id,
        period_start=r.period_start,
        period_end=r.period_end,
        gross_amount=float(r.gross_amount),
        commission_amount=float(r.commission_amount),
        processing_fees=float(r.processing_fees),
        net_amount=float(r.net_amount),
        status=r.status,
        bank_ref=r.bank_ref,
        paid_at=r.paid_at,
        created_at=r.created_at,
        line_items=[],  # not loaded in list/calculate responses
    )


@router.post("/payouts/calculate")
async def admin_calculate_payouts(
    payload: PayoutCalculateRequest,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if payload.seller_id:
        seller_ids = [payload.seller_id]
    else:
        rows = (
            await db.execute(
                select(distinct(Order.seller_id)).where(
                    Order.status == "completed",
                    Order.seller_id.isnot(None),
                    Order.created_at >= payload.period_start,
                    Order.created_at <= payload.period_end,
                )
            )
        ).scalars().all()
        seller_ids = list(rows)

    results = []
    for sid in seller_ids:
        record = await calculate_payout(sid, payload.period_start, payload.period_end, db)
        if record:
            results.append(record)

    await db.commit()
    return [_payout_to_response(r) for r in results]


@router.get("/payouts", response_model=PaginatedPayouts)
async def list_payouts(
    status: Optional[str] = Query(None),
    seller_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    conditions = []
    if status:
        conditions.append(PayoutRecord.status == status)
    if seller_id:
        conditions.append(PayoutRecord.seller_id == seller_id)

    count_q = select(func.count(PayoutRecord.id))
    if conditions:
        count_q = count_q.where(*conditions)
    total: int = (await db.execute(count_q)).scalar() or 0

    data_q = (
        select(PayoutRecord)
        .order_by(PayoutRecord.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    if conditions:
        data_q = data_q.where(*conditions)

    records = (await db.execute(data_q)).scalars().all()
    return PaginatedPayouts(
        items=[_payout_to_response(r) for r in records],
        total=total,
        page=page,
        pages=math.ceil(total / limit) if total else 0,
    )


@router.put("/payouts/{payout_id}/mark-paid", response_model=PayoutRecordResponse)
async def mark_payout_paid(
    payout_id: uuid.UUID,
    payload: MarkPaidRequest,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    record = (
        await db.execute(select(PayoutRecord).where(PayoutRecord.id == payout_id))
    ).scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="Payout record not found")
    record.status = "paid"
    record.bank_ref = payload.bank_ref
    record.paid_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(record)
    return _payout_to_response(record)
