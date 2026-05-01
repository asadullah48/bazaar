import math
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_active_user, require_buyer, require_seller
from app.models.order import Order, OrderLineItem, OrderStatusHistory
from app.models.rfq import RFQ, RFQQuote
from app.models.user import User
from app.schemas.rfq import (
    CounterOffer,
    PaginatedRFQs,
    QuoteCreate,
    QuoteResponse,
    RFQCreate,
    RFQListItem,
    RFQResponse,
)

router = APIRouter(tags=["rfq"])

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
_PK_PHONE_RE = re.compile(r"((\+92|0092|92|0)[0-9\s\-]{9,13})")
BLOCK_PATTERNS = [_EMAIL_RE, _PK_PHONE_RE]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _order_number() -> str:
    year = datetime.now().year
    return f"BZR-{year}-{uuid.uuid4().hex[:6].upper()}"


def _rfq_to_response(rfq: RFQ, include_quotes: bool = False) -> RFQResponse:
    return RFQResponse(
        id=rfq.id,
        buyer_id=rfq.buyer_id,
        seller_id=rfq.seller_id,
        product_id=rfq.product_id,
        title=rfq.title,
        description=rfq.description,
        quantity=rfq.quantity,
        target_price=float(rfq.target_price) if rfq.target_price is not None else None,
        delivery_city=rfq.delivery_city,
        payment_terms=rfq.payment_terms,
        deadline_date=rfq.deadline_date,
        status=rfq.status,
        expires_at=rfq.expires_at,
        created_at=rfq.created_at,
        quotes=[_quote_to_response(q) for q in rfq.quotes] if include_quotes else [],
    )


def _quote_to_response(q: RFQQuote) -> QuoteResponse:
    return QuoteResponse(
        id=q.id,
        rfq_id=q.rfq_id,
        seller_id=q.seller_id,
        unit_price=float(q.unit_price),
        lead_time_days=q.lead_time_days,
        valid_until=q.valid_until,
        notes=q.notes,
        status=q.status,
        counter_price=float(q.counter_price) if q.counter_price is not None else None,
        created_at=q.created_at,
    )


# ── RFQ endpoints ─────────────────────────────────────────────────────────────

@router.post("/rfqs", response_model=RFQResponse, status_code=201)
async def create_rfq(
    payload: RFQCreate,
    user: User = Depends(require_buyer),
    db: AsyncSession = Depends(get_db),
):
    for pattern in BLOCK_PATTERNS:
        for field in (payload.title, payload.description or ""):
            if pattern.search(field):
                raise HTTPException(
                    status_code=400,
                    detail="Content contains prohibited contact information",
                )

    now = _utcnow()
    rfq = RFQ(
        buyer_id=user.id,
        seller_id=payload.seller_id,
        product_id=payload.product_id,
        title=payload.title,
        description=payload.description,
        quantity=payload.quantity,
        target_price=payload.target_price,
        delivery_city=payload.delivery_city,
        payment_terms=payload.payment_terms,
        deadline_date=payload.deadline_date,
        status="open",
        expires_at=now + timedelta(days=7),
    )
    db.add(rfq)
    await db.commit()
    await db.refresh(rfq)
    return _rfq_to_response(rfq)


@router.get("/rfqs", response_model=PaginatedRFQs)
async def list_rfqs(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role in ("consumer", "business_buyer"):
        conditions = [RFQ.buyer_id == user.id]
    else:
        # seller/admin: directed at them OR broadcast (no seller_id)
        conditions = [or_(RFQ.seller_id == user.id, RFQ.seller_id.is_(None))]

    if status:
        conditions.append(RFQ.status == status)

    total: int = (
        await db.execute(select(func.count(RFQ.id)).where(*conditions))
    ).scalar() or 0

    rows = (
        await db.execute(
            select(RFQ)
            .where(*conditions)
            .order_by(RFQ.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    ).scalars().all()

    items = [
        RFQListItem(
            id=r.id,
            title=r.title,
            quantity=r.quantity,
            status=r.status,
            created_at=r.created_at,
            deadline_date=r.deadline_date,
            seller_id=r.seller_id,
        )
        for r in rows
    ]
    return PaginatedRFQs(
        items=items,
        total=total,
        page=page,
        pages=math.ceil(total / limit) if total else 0,
    )


@router.get("/rfqs/{rfq_id}", response_model=RFQResponse)
async def get_rfq(
    rfq_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    rfq = (
        await db.execute(
            select(RFQ).options(selectinload(RFQ.quotes)).where(RFQ.id == rfq_id)
        )
    ).scalar_one_or_none()
    if rfq is None:
        raise HTTPException(status_code=404, detail="RFQ not found")

    is_buyer = rfq.buyer_id == user.id
    is_seller = user.role == "seller" and (rfq.seller_id is None or rfq.seller_id == user.id)
    is_admin = user.role == "admin"

    if not (is_buyer or is_seller or is_admin):
        raise HTTPException(status_code=403, detail="Access denied")

    return _rfq_to_response(rfq, include_quotes=True)


@router.delete("/rfqs/{rfq_id}", status_code=204)
async def close_rfq(
    rfq_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    rfq = (
        await db.execute(select(RFQ).where(RFQ.id == rfq_id))
    ).scalar_one_or_none()
    if rfq is None:
        raise HTTPException(status_code=404, detail="RFQ not found")
    if rfq.buyer_id != user.id:
        raise HTTPException(status_code=403, detail="Not your RFQ")
    if rfq.status != "open":
        raise HTTPException(status_code=400, detail="Only open RFQs can be closed")

    rfq.status = "closed"
    await db.commit()


# ── Quote sub-resource ────────────────────────────────────────────────────────

@router.post("/rfqs/{rfq_id}/quotes", response_model=QuoteResponse, status_code=201)
async def submit_quote(
    rfq_id: uuid.UUID,
    payload: QuoteCreate,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    rfq = (
        await db.execute(select(RFQ).where(RFQ.id == rfq_id))
    ).scalar_one_or_none()
    if rfq is None:
        raise HTTPException(status_code=404, detail="RFQ not found")
    if rfq.status not in ("open", "quoted"):
        raise HTTPException(status_code=400, detail="RFQ is not open for quotes")
    if rfq.buyer_id == seller.id:
        raise HTTPException(status_code=400, detail="Cannot quote your own RFQ")

    existing = (
        await db.execute(
            select(RFQQuote).where(
                RFQQuote.rfq_id == rfq_id,
                RFQQuote.seller_id == seller.id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="You have already quoted this RFQ")

    quote = RFQQuote(
        rfq_id=rfq_id,
        seller_id=seller.id,
        unit_price=payload.unit_price,
        lead_time_days=payload.lead_time_days,
        valid_until=payload.valid_until,
        notes=payload.notes,
        status="pending",
    )
    db.add(quote)
    rfq.status = "quoted"
    await db.commit()
    await db.refresh(quote)
    return _quote_to_response(quote)


@router.get("/rfqs/{rfq_id}/quotes", response_model=list[QuoteResponse])
async def list_quotes(
    rfq_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    rfq = (
        await db.execute(select(RFQ).where(RFQ.id == rfq_id))
    ).scalar_one_or_none()
    if rfq is None:
        raise HTTPException(status_code=404, detail="RFQ not found")

    if user.role in ("consumer", "business_buyer"):
        if rfq.buyer_id != user.id:
            raise HTTPException(status_code=403, detail="Not your RFQ")
        quotes = (
            await db.execute(select(RFQQuote).where(RFQQuote.rfq_id == rfq_id))
        ).scalars().all()
    elif user.role == "seller":
        quotes = (
            await db.execute(
                select(RFQQuote).where(
                    RFQQuote.rfq_id == rfq_id,
                    RFQQuote.seller_id == user.id,
                )
            )
        ).scalars().all()
    else:
        quotes = (
            await db.execute(select(RFQQuote).where(RFQQuote.rfq_id == rfq_id))
        ).scalars().all()

    return [_quote_to_response(q) for q in quotes]


@router.put("/rfqs/{rfq_id}/quotes/{quote_id}/accept")
async def accept_quote(
    rfq_id: uuid.UUID,
    quote_id: uuid.UUID,
    user: User = Depends(require_buyer),
    db: AsyncSession = Depends(get_db),
):
    rfq = (
        await db.execute(select(RFQ).where(RFQ.id == rfq_id))
    ).scalar_one_or_none()
    if rfq is None or rfq.buyer_id != user.id:
        raise HTTPException(status_code=404, detail="RFQ not found")
    if rfq.status not in ("quoted", "negotiating"):
        raise HTTPException(status_code=400, detail="RFQ is not in a quotable state")

    quote = (
        await db.execute(
            select(RFQQuote).where(RFQQuote.id == quote_id, RFQQuote.rfq_id == rfq_id)
        )
    ).scalar_one_or_none()
    if quote is None:
        raise HTTPException(status_code=404, detail="Quote not found")
    if quote.status not in ("pending", "countered"):
        raise HTTPException(status_code=400, detail="Quote cannot be accepted in its current state")

    # Use counter_price if the quote was countered, otherwise original unit_price
    effective_price = float(quote.counter_price) if quote.counter_price is not None else float(quote.unit_price)

    # Accept this quote, reject all others on this RFQ
    all_quotes = (
        await db.execute(select(RFQQuote).where(RFQQuote.rfq_id == rfq_id))
    ).scalars().all()
    for q in all_quotes:
        q.status = "accepted" if q.id == quote_id else "rejected"

    rfq.status = "accepted"

    total_amount = rfq.quantity * effective_price
    payment_method = rfq.payment_terms or "bank_transfer"
    delivery_address = {"city": rfq.delivery_city} if rfq.delivery_city else {}

    order = Order(
        order_number=_order_number(),
        rfq_id=quote.id,
        buyer_id=rfq.buyer_id,
        seller_id=quote.seller_id,
        payment_method=payment_method,
        payment_status="pending",
        subtotal=total_amount,
        shipping_cost=0,
        discount_amount=0,
        total_amount=total_amount,
        currency="PKR",
        delivery_address=delivery_address,
        status="payment_confirmed",
        is_b2b=True,
        payment_terms=rfq.payment_terms,
    )
    db.add(order)
    await db.flush()

    db.add(OrderLineItem(
        order_id=order.id,
        variant_id=None,
        product_snapshot={"title": rfq.title, "rfq_id": str(rfq_id)},
        quantity=rfq.quantity,
        unit_price=effective_price,
    ))
    db.add(OrderStatusHistory(
        order_id=order.id,
        from_status=None,
        to_status="payment_confirmed",
        changed_by=user.id,
    ))

    await db.commit()
    await db.refresh(order)

    return {
        "order_id": str(order.id),
        "order_number": order.order_number,
        "total_amount": float(order.total_amount),
    }


@router.put("/rfqs/{rfq_id}/quotes/{quote_id}/reject", status_code=204)
async def reject_quote(
    rfq_id: uuid.UUID,
    quote_id: uuid.UUID,
    user: User = Depends(require_buyer),
    db: AsyncSession = Depends(get_db),
):
    rfq = (
        await db.execute(select(RFQ).where(RFQ.id == rfq_id))
    ).scalar_one_or_none()
    if rfq is None or rfq.buyer_id != user.id:
        raise HTTPException(status_code=404, detail="RFQ not found")

    quote = (
        await db.execute(
            select(RFQQuote).where(RFQQuote.id == quote_id, RFQQuote.rfq_id == rfq_id)
        )
    ).scalar_one_or_none()
    if quote is None:
        raise HTTPException(status_code=404, detail="Quote not found")

    quote.status = "rejected"
    await db.commit()


@router.put("/rfqs/{rfq_id}/quotes/{quote_id}/counter", response_model=QuoteResponse)
async def counter_quote(
    rfq_id: uuid.UUID,
    quote_id: uuid.UUID,
    payload: CounterOffer,
    user: User = Depends(require_buyer),
    db: AsyncSession = Depends(get_db),
):
    rfq = (
        await db.execute(select(RFQ).where(RFQ.id == rfq_id))
    ).scalar_one_or_none()
    if rfq is None or rfq.buyer_id != user.id:
        raise HTTPException(status_code=404, detail="RFQ not found")

    quote = (
        await db.execute(
            select(RFQQuote).where(RFQQuote.id == quote_id, RFQQuote.rfq_id == rfq_id)
        )
    ).scalar_one_or_none()
    if quote is None:
        raise HTTPException(status_code=404, detail="Quote not found")
    if quote.status != "pending":
        raise HTTPException(status_code=400, detail="Can only counter a pending quote")

    quote.counter_price = payload.counter_price
    quote.status = "countered"
    rfq.status = "negotiating"
    await db.commit()
    await db.refresh(quote)
    return _quote_to_response(quote)
