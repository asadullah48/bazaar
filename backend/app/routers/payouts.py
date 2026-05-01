import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_seller
from app.models.payout import PayoutLineItem, PayoutRecord
from app.models.user import User
from app.schemas.payout import (
    PaginatedPayouts,
    PayoutLineItemResponse,
    PayoutRecordResponse,
)

router = APIRouter(tags=["payouts"])


def _payout_to_response(r: PayoutRecord, include_lines: bool = False) -> PayoutRecordResponse:
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
        line_items=[
            PayoutLineItemResponse(
                id=li.id,
                order_id=li.order_id,
                order_total=float(li.order_total),
                commission_rate=float(li.commission_rate),
                commission_amount=float(li.commission_amount),
                processing_fee=float(li.processing_fee),
                seller_payout=float(li.seller_payout),
            )
            for li in r.line_items
        ] if include_lines else [],
    )


@router.get("/seller/payouts", response_model=PaginatedPayouts)
async def list_seller_payouts(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    total: int = (
        await db.execute(
            select(func.count(PayoutRecord.id)).where(PayoutRecord.seller_id == seller.id)
        )
    ).scalar() or 0

    records = (
        await db.execute(
            select(PayoutRecord)
            .where(PayoutRecord.seller_id == seller.id)
            .order_by(PayoutRecord.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    ).scalars().all()

    return PaginatedPayouts(
        items=[_payout_to_response(r) for r in records],
        total=total,
        page=page,
        pages=math.ceil(total / limit) if total else 0,
    )


@router.get("/seller/payouts/{payout_id}", response_model=PayoutRecordResponse)
async def get_seller_payout(
    payout_id: uuid.UUID,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    record = (
        await db.execute(
            select(PayoutRecord)
            .options(selectinload(PayoutRecord.line_items))
            .where(PayoutRecord.id == payout_id, PayoutRecord.seller_id == seller.id)
        )
    ).scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="Payout not found")
    return _payout_to_response(record, include_lines=True)
