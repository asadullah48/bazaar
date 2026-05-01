# RFQ Flow + Payout Calculation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a complete B2B RFQ (Request for Quote) negotiation flow and weekly commission payout calculation for sellers.

**Architecture:** Three tasks build on each other — 11a adds the RFQ resource CRUD, 11b adds the seller-quote and buyer-counter/accept negotiation sub-resource, 11c adds a commission service that walks completed orders to calculate net payouts. All code follows existing async SQLAlchemy + FastAPI patterns already established in the codebase.

**Tech Stack:** FastAPI, SQLAlchemy async, Pydantic v2, PostgreSQL (asyncpg), pytest-asyncio, httpx AsyncClient for tests.

---

## Pre-flight checks

Before touching any file, verify the test suite is green:

```bash
cd D:\bazaar\backend
source .venv/Scripts/activate
python -m pytest tests/ -q
```

Expected: 65 passed. If not, stop and fix first.

---

## Task 11a — RFQ schemas + buyer creates RFQ

### Files
- Create: `backend/app/schemas/rfq.py`
- Create: `backend/app/routers/rfq.py`
- Modify: `backend/app/main.py` (wire router)
- Test: `backend/tests/test_rfq.py`

---

### Step 1: Write the failing tests first

Create `backend/tests/test_rfq.py`:

```python
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, update

from app.main import app
from app.models.user import User
from app.models.rfq import RFQ
from tests.conftest import _TestSession

AUTH = "/v1/auth"
RFQS = "/v1/rfqs"


def _email(prefix="user"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}@test.dev"


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def _register_login(client, role="consumer"):
    email = _email(role)
    pw = "Pass123!"
    await client.post(f"{AUTH}/register", json={"email": email, "password": pw, "role": role})
    token = (
        await client.post(f"{AUTH}/login", json={"email": email, "password": pw})
    ).json()["access_token"]
    return email, token


@pytest.fixture
async def buyer(client):
    email, token = await _register_login(client, "consumer")
    me = (await client.get("/v1/users/me", headers={"Authorization": f"Bearer {token}"})).json()
    user_id = uuid.UUID(me["id"])
    yield {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}, "id": user_id}
    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


@pytest.fixture
async def seller(client):
    email, token = await _register_login(client, "seller")
    me = (await client.get("/v1/users/me", headers={"Authorization": f"Bearer {token}"})).json()
    user_id = uuid.UUID(me["id"])
    yield {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}, "id": user_id}
    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


# ── Task 11a tests ─────────────────────────────────────────────────────────────

async def test_buyer_creates_rfq(client, buyer):
    resp = await client.post(
        RFQS,
        json={"title": "Need 500 shirts", "quantity": 500, "target_price": 10.0},
        headers=buyer["headers"],
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["status"] == "open"
    assert data["expires_at"] is not None
    assert data["buyer_id"] == str(buyer["id"])
    # cleanup
    async with _TestSession() as db:
        await db.execute(delete(RFQ).where(RFQ.id == uuid.UUID(data["id"])))
        await db.commit()


async def test_buyer_lists_own_rfqs(client, buyer):
    r = await client.post(
        RFQS,
        json={"title": "Buyer list test", "quantity": 100},
        headers=buyer["headers"],
    )
    rfq_id = uuid.UUID(r.json()["id"])

    resp = await client.get(RFQS, headers=buyer["headers"])
    assert resp.status_code == 200
    ids = [item["id"] for item in resp.json()["items"]]
    assert str(rfq_id) in ids

    async with _TestSession() as db:
        await db.execute(delete(RFQ).where(RFQ.id == rfq_id))
        await db.commit()


async def test_seller_sees_broadcast_rfq(client, buyer, seller):
    # RFQ with no seller_id = broadcast
    r = await client.post(
        RFQS,
        json={"title": "Broadcast RFQ", "quantity": 200},
        headers=buyer["headers"],
    )
    rfq_id = uuid.UUID(r.json()["id"])

    resp = await client.get(RFQS, headers=seller["headers"])
    assert resp.status_code == 200
    ids = [item["id"] for item in resp.json()["items"]]
    assert str(rfq_id) in ids

    async with _TestSession() as db:
        await db.execute(delete(RFQ).where(RFQ.id == rfq_id))
        await db.commit()


async def test_buyer_closes_rfq(client, buyer):
    r = await client.post(
        RFQS,
        json={"title": "To close", "quantity": 50},
        headers=buyer["headers"],
    )
    rfq_id = r.json()["id"]

    resp = await client.delete(f"{RFQS}/{rfq_id}", headers=buyer["headers"])
    assert resp.status_code == 204

    # cannot re-close
    resp2 = await client.delete(f"{RFQS}/{rfq_id}", headers=buyer["headers"])
    assert resp2.status_code == 400

    async with _TestSession() as db:
        await db.execute(delete(RFQ).where(RFQ.id == uuid.UUID(rfq_id)))
        await db.commit()
```

### Step 2: Run tests — expect failures (routers not yet built)

```bash
cd D:\bazaar\backend
python -m pytest tests/test_rfq.py -v
```

Expected: 4 errors/failures because `/v1/rfqs` doesn't exist yet.

### Step 3: Create `backend/app/schemas/rfq.py`

```python
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, field_validator


class RFQCreate(BaseModel):
    title: str
    description: Optional[str] = None
    product_id: Optional[uuid.UUID] = None
    seller_id: Optional[uuid.UUID] = None
    quantity: int
    target_price: Optional[float] = None
    delivery_city: Optional[str] = None
    payment_terms: Optional[str] = None
    deadline_date: Optional[date] = None

    @field_validator("quantity")
    @classmethod
    def quantity_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("quantity must be > 0")
        return v


class RFQResponse(BaseModel):
    id: uuid.UUID
    buyer_id: uuid.UUID
    seller_id: Optional[uuid.UUID] = None
    product_id: Optional[uuid.UUID] = None
    title: str
    description: Optional[str] = None
    quantity: int
    target_price: Optional[float] = None
    delivery_city: Optional[str] = None
    payment_terms: Optional[str] = None
    deadline_date: Optional[date] = None
    status: str
    expires_at: Optional[datetime] = None
    created_at: datetime
    quotes: List["QuoteResponse"] = []


class RFQListItem(BaseModel):
    id: uuid.UUID
    title: str
    quantity: int
    status: str
    created_at: datetime
    deadline_date: Optional[date] = None
    seller_id: Optional[uuid.UUID] = None


class PaginatedRFQs(BaseModel):
    items: List[RFQListItem]
    total: int
    page: int
    pages: int


class QuoteCreate(BaseModel):
    unit_price: float
    lead_time_days: int
    valid_until: Optional[date] = None
    notes: Optional[str] = None

    @field_validator("unit_price")
    @classmethod
    def price_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("unit_price must be > 0")
        return v

    @field_validator("lead_time_days")
    @classmethod
    def days_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("lead_time_days must be > 0")
        return v


class QuoteResponse(BaseModel):
    id: uuid.UUID
    rfq_id: uuid.UUID
    seller_id: uuid.UUID
    unit_price: float
    lead_time_days: int
    valid_until: Optional[date] = None
    notes: Optional[str] = None
    status: str
    counter_price: Optional[float] = None
    created_at: datetime


class CounterOffer(BaseModel):
    counter_price: float

    @field_validator("counter_price")
    @classmethod
    def price_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("counter_price must be > 0")
        return v
```

### Step 4: Create `backend/app/routers/rfq.py`

```python
import math
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_active_user, require_buyer, require_seller
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
                raise HTTPException(status_code=400, detail="Content contains prohibited contact information")

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
        # seller sees RFQs directed at them OR broadcast (no seller_id)
        from sqlalchemy import or_
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
    from sqlalchemy.orm import selectinload
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

    # Determine effective unit price (counter price takes precedence if countered)
    effective_price = float(quote.counter_price) if quote.counter_price is not None else float(quote.unit_price)

    # Accept this quote, reject all others
    all_quotes = (
        await db.execute(select(RFQQuote).where(RFQQuote.rfq_id == rfq_id))
    ).scalars().all()
    for q in all_quotes:
        if q.id == quote_id:
            q.status = "accepted"
        else:
            q.status = "rejected"

    rfq.status = "accepted"

    # Create order from quote
    from app.models.order import Order, OrderLineItem, OrderStatusHistory

    def _order_number() -> str:
        import uuid as _uuid
        from datetime import datetime as _dt
        year = _dt.now().year
        return f"BZR-{year}-{_uuid.uuid4().hex[:6].upper()}"

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

    snapshot = {"title": rfq.title, "rfq_id": str(rfq_id)}
    li = OrderLineItem(
        order_id=order.id,
        variant_id=None,
        product_snapshot=snapshot,
        quantity=rfq.quantity,
        unit_price=effective_price,
    )
    db.add(li)

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
```

### Step 5: Wire the router into `backend/app/main.py`

Add after the existing imports and router registrations:

```python
# In imports section, add:
from app.routers import rfq as rfq_router

# In router registrations, add:
app.include_router(rfq_router.router, prefix="/v1")
```

### Step 6: Run the 11a tests

```bash
cd D:\bazaar\backend
python -m pytest tests/test_rfq.py::test_buyer_creates_rfq tests/test_rfq.py::test_buyer_lists_own_rfqs tests/test_rfq.py::test_seller_sees_broadcast_rfq tests/test_rfq.py::test_buyer_closes_rfq -v
```

Expected: 4 passed.

### Step 7: Run full suite — must be 69 green

```bash
python -m pytest tests/ -q
```

Expected: 69 passed.

---

## Task 11b — Seller quotes + buyer response

### Files
- Modify: `backend/app/schemas/rfq.py` (QuoteCreate, QuoteResponse, CounterOffer already written above)
- Modify: `backend/app/routers/rfq.py` (quote endpoints already written above)
- Modify: `backend/tests/test_rfq.py` (add 5 more tests)

**Note:** The schemas and router code above already include ALL of 11b. So at this point, the only step is adding the new tests.

### Step 8: Add 11b tests to `backend/tests/test_rfq.py`

Append the following test functions to the file:

```python
# ── Task 11b tests ─────────────────────────────────────────────────────────────

async def test_seller_submits_quote_visible_to_buyer(client, buyer, seller):
    # Create a broadcast RFQ
    r = await client.post(
        RFQS,
        json={"title": "Quote visibility test", "quantity": 100},
        headers=buyer["headers"],
    )
    rfq_id = r.json()["id"]

    # Seller submits quote
    q = await client.post(
        f"{RFQS}/{rfq_id}/quotes",
        json={"unit_price": 50.0, "lead_time_days": 7},
        headers=seller["headers"],
    )
    assert q.status_code == 201, q.text
    quote_id = q.json()["id"]

    # Buyer can see it
    quotes = await client.get(f"{RFQS}/{rfq_id}/quotes", headers=buyer["headers"])
    assert quotes.status_code == 200
    ids = [qr["id"] for qr in quotes.json()]
    assert quote_id in ids

    # RFQ status updated to quoted
    rfq_resp = await client.get(f"{RFQS}/{rfq_id}", headers=buyer["headers"])
    assert rfq_resp.json()["status"] == "quoted"

    async with _TestSession() as db:
        await db.execute(delete(RFQ).where(RFQ.id == uuid.UUID(rfq_id)))
        await db.commit()


async def test_buyer_counters_quote(client, buyer, seller):
    r = await client.post(
        RFQS,
        json={"title": "Counter test", "quantity": 100},
        headers=buyer["headers"],
    )
    rfq_id = r.json()["id"]

    q = await client.post(
        f"{RFQS}/{rfq_id}/quotes",
        json={"unit_price": 50.0, "lead_time_days": 7},
        headers=seller["headers"],
    )
    quote_id = q.json()["id"]

    # Buyer counters
    counter_resp = await client.put(
        f"{RFQS}/{rfq_id}/quotes/{quote_id}/counter",
        json={"counter_price": 40.0},
        headers=buyer["headers"],
    )
    assert counter_resp.status_code == 200, counter_resp.text
    assert counter_resp.json()["status"] == "countered"
    assert counter_resp.json()["counter_price"] == 40.0

    # RFQ status is now negotiating
    rfq_resp = await client.get(f"{RFQS}/{rfq_id}", headers=buyer["headers"])
    assert rfq_resp.json()["status"] == "negotiating"

    async with _TestSession() as db:
        await db.execute(delete(RFQ).where(RFQ.id == uuid.UUID(rfq_id)))
        await db.commit()


async def test_buyer_accepts_creates_order_and_rejects_others(client, buyer, seller):
    from app.models.order import Order

    r = await client.post(
        RFQS,
        json={"title": "Accept test", "quantity": 10, "delivery_city": "Lahore"},
        headers=buyer["headers"],
    )
    rfq_id = r.json()["id"]

    # Seller submits quote
    q = await client.post(
        f"{RFQS}/{rfq_id}/quotes",
        json={"unit_price": 100.0, "lead_time_days": 5},
        headers=seller["headers"],
    )
    quote_id = q.json()["id"]

    # Buyer counters to 80
    await client.put(
        f"{RFQS}/{rfq_id}/quotes/{quote_id}/counter",
        json={"counter_price": 80.0},
        headers=buyer["headers"],
    )

    # Buyer accepts the countered quote
    accept_resp = await client.put(
        f"{RFQS}/{rfq_id}/quotes/{quote_id}/accept",
        headers=buyer["headers"],
    )
    assert accept_resp.status_code == 200, accept_resp.text
    data = accept_resp.json()
    assert "order_id" in data
    assert data["total_amount"] == 800.0  # 10 * 80.0

    # RFQ is now accepted
    rfq_resp = await client.get(f"{RFQS}/{rfq_id}", headers=buyer["headers"])
    assert rfq_resp.json()["status"] == "accepted"

    # Cleanup: delete order then RFQ
    async with _TestSession() as db:
        order_id = uuid.UUID(data["order_id"])
        await db.execute(delete(Order).where(Order.id == order_id))
        await db.execute(delete(RFQ).where(RFQ.id == uuid.UUID(rfq_id)))
        await db.commit()


async def test_buyer_rejects_quote(client, buyer, seller):
    r = await client.post(
        RFQS,
        json={"title": "Reject test", "quantity": 50},
        headers=buyer["headers"],
    )
    rfq_id = r.json()["id"]

    q = await client.post(
        f"{RFQS}/{rfq_id}/quotes",
        json={"unit_price": 20.0, "lead_time_days": 3},
        headers=seller["headers"],
    )
    quote_id = q.json()["id"]

    reject_resp = await client.put(
        f"{RFQS}/{rfq_id}/quotes/{quote_id}/reject",
        headers=buyer["headers"],
    )
    assert reject_resp.status_code == 204

    # Verify status
    quotes = await client.get(f"{RFQS}/{rfq_id}/quotes", headers=buyer["headers"])
    assert quotes.json()[0]["status"] == "rejected"

    async with _TestSession() as db:
        await db.execute(delete(RFQ).where(RFQ.id == uuid.UUID(rfq_id)))
        await db.commit()


async def test_seller_cannot_quote_twice(client, buyer, seller):
    r = await client.post(
        RFQS,
        json={"title": "Duplicate quote test", "quantity": 30},
        headers=buyer["headers"],
    )
    rfq_id = r.json()["id"]

    await client.post(
        f"{RFQS}/{rfq_id}/quotes",
        json={"unit_price": 15.0, "lead_time_days": 4},
        headers=seller["headers"],
    )
    second = await client.post(
        f"{RFQS}/{rfq_id}/quotes",
        json={"unit_price": 12.0, "lead_time_days": 3},
        headers=seller["headers"],
    )
    assert second.status_code == 409

    async with _TestSession() as db:
        await db.execute(delete(RFQ).where(RFQ.id == uuid.UUID(rfq_id)))
        await db.commit()
```

### Step 9: Run all 9 RFQ tests

```bash
cd D:\bazaar\backend
python -m pytest tests/test_rfq.py -v
```

Expected: 9 passed.

### Step 10: Run full suite — must be 74 green

```bash
python -m pytest tests/ -q
```

Expected: 74 passed.

---

## Task 11c — Payout calculation

### Files
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/commission.py`
- Modify: `backend/app/routers/admin.py` (add payout endpoints)
- Create: `backend/app/schemas/payout.py`
- Create: `backend/app/routers/payouts.py` (seller payout view endpoints)
- Modify: `backend/app/main.py` (wire payouts router)
- Create: `backend/tests/test_payouts.py`

### Step 11: Write the failing tests first

Create `backend/tests/test_payouts.py`:

```python
import uuid
import pytest
from datetime import date, datetime, timezone, timedelta
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, update

from app.main import app
from app.models.user import User, SellerProfile
from app.models.order import Order, OrderLineItem, OrderStatusHistory
from app.models.catalog import Category, Product, ProductVariant
from app.models.payout import PayoutRecord, PayoutLineItem
from tests.conftest import _TestSession

AUTH = "/v1/auth"
ADMIN_PAYOUTS = "/v1/admin/payouts"
SELLER_PAYOUTS = "/v1/seller/payouts"


def _email(prefix="user"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}@test.dev"


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def _register_login(client, role="consumer"):
    email = _email(role)
    pw = "Pass123!"
    await client.post(f"{AUTH}/register", json={"email": email, "password": pw, "role": role})
    token = (
        await client.post(f"{AUTH}/login", json={"email": email, "password": pw})
    ).json()["access_token"]
    me = (await client.get("/v1/users/me", headers={"Authorization": f"Bearer {token}"})).json()
    return email, token, uuid.UUID(me["id"])


@pytest.fixture
async def admin_user(client):
    email, token, user_id = await _register_login(client, "admin")
    yield {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}, "id": user_id}
    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


@pytest.fixture
async def seller_with_completed_order(client):
    """Creates a seller with a completed order and a product in a category with 10% commission."""
    seller_email, seller_token, seller_id = await _register_login(client, "seller")
    buyer_email, buyer_token, buyer_id = await _register_login(client, "consumer")
    seller_hdrs = {"Authorization": f"Bearer {seller_token}"}

    async with _TestSession() as db:
        # Create a category with known commission rate
        category = Category(
            name=f"Test Cat {uuid.uuid4().hex[:6]}",
            slug=f"test-cat-{uuid.uuid4().hex[:6]}",
            commission_rate=10.00,
        )
        db.add(category)
        await db.flush()

        # Create product under that category
        product = Product(
            seller_id=seller_id,
            category_id=category.id,
            title="Payout Test Product",
            status="published",
        )
        db.add(product)
        await db.flush()

        # Create variant
        variant = ProductVariant(
            product_id=product.id,
            price=1000.0,
            stock_qty=100,
        )
        db.add(variant)
        await db.flush()

        # Create a completed order (total_amount = 1000.0)
        order = Order(
            order_number=f"BZR-2026-{uuid.uuid4().hex[:6].upper()}",
            buyer_id=buyer_id,
            seller_id=seller_id,
            payment_method="bank_transfer",
            payment_status="paid",
            subtotal=1000.0,
            shipping_cost=0,
            discount_amount=0,
            total_amount=1000.0,
            currency="PKR",
            delivery_address={"city": "Karachi"},
            status="completed",
        )
        db.add(order)
        await db.flush()

        li = OrderLineItem(
            order_id=order.id,
            variant_id=variant.id,
            product_snapshot={"title": "Payout Test Product"},
            quantity=1,
            unit_price=1000.0,
        )
        db.add(li)
        await db.commit()

        order_id = order.id
        category_id = category.id
        product_id = product.id
        variant_id = variant.id

    yield {
        "seller_email": seller_email,
        "seller_token": seller_token,
        "seller_headers": {"Authorization": f"Bearer {seller_token}"},
        "seller_id": seller_id,
        "buyer_email": buyer_email,
        "buyer_id": buyer_id,
        "order_id": order_id,
        "order_total": 1000.0,
        "commission_rate": 10.0,
        "category_id": category_id,
        "product_id": product_id,
        "variant_id": variant_id,
    }

    async with _TestSession() as db:
        # Clean up in reverse FK order
        await db.execute(delete(PayoutLineItem).where(
            PayoutLineItem.order_id == order_id
        ))
        await db.execute(delete(PayoutRecord).where(
            PayoutRecord.seller_id == seller_id
        ))
        await db.execute(delete(Order).where(Order.id == order_id))
        await db.execute(delete(ProductVariant).where(ProductVariant.id == variant_id))
        await db.execute(delete(Product).where(Product.id == product_id))
        await db.execute(delete(Category).where(Category.id == category_id))
        await db.execute(delete(User).where(User.email == seller_email))
        await db.execute(delete(User).where(User.email == buyer_email))
        await db.commit()


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_calculate_payout_creates_record(client, admin_user, seller_with_completed_order):
    fixture = seller_with_completed_order

    resp = await client.post(
        f"{ADMIN_PAYOUTS}/calculate",
        json={
            "seller_id": str(fixture["seller_id"]),
            "period_start": "2026-01-01",
            "period_end": "2026-12-31",
        },
        headers=admin_user["headers"],
    )
    assert resp.status_code == 200, resp.text
    records = resp.json()
    assert len(records) >= 1
    record = next(r for r in records if r["seller_id"] == str(fixture["seller_id"]))
    assert record["status"] == "pending"
    assert record["gross_amount"] == 1000.0


async def test_commission_math_correct(client, admin_user, seller_with_completed_order):
    fixture = seller_with_completed_order
    order_total = fixture["order_total"]        # 1000.0
    commission_rate = fixture["commission_rate"]  # 10.0 %

    resp = await client.post(
        f"{ADMIN_PAYOUTS}/calculate",
        json={
            "seller_id": str(fixture["seller_id"]),
            "period_start": "2026-01-01",
            "period_end": "2026-12-31",
        },
        headers=admin_user["headers"],
    )
    assert resp.status_code == 200, resp.text
    records = resp.json()
    record = next(r for r in records if r["seller_id"] == str(fixture["seller_id"]))

    expected_commission = order_total * commission_rate / 100   # 100.0
    expected_processing = order_total * 0.015                   # 15.0
    expected_net = order_total - expected_commission - expected_processing  # 885.0

    assert abs(record["net_amount"] - expected_net) < 0.01
    assert abs(record["commission_amount"] - expected_commission) < 0.01


async def test_mark_payout_paid(client, admin_user, seller_with_completed_order):
    fixture = seller_with_completed_order

    create_resp = await client.post(
        f"{ADMIN_PAYOUTS}/calculate",
        json={
            "seller_id": str(fixture["seller_id"]),
            "period_start": "2026-01-01",
            "period_end": "2026-12-31",
        },
        headers=admin_user["headers"],
    )
    record_id = next(
        r["id"] for r in create_resp.json()
        if r["seller_id"] == str(fixture["seller_id"])
    )

    paid_resp = await client.put(
        f"{ADMIN_PAYOUTS}/{record_id}/mark-paid",
        json={"bank_ref": "PKB-2026-001"},
        headers=admin_user["headers"],
    )
    assert paid_resp.status_code == 200, paid_resp.text
    assert paid_resp.json()["status"] == "paid"
    assert paid_resp.json()["bank_ref"] == "PKB-2026-001"


async def test_seller_views_own_payout_history(client, admin_user, seller_with_completed_order):
    fixture = seller_with_completed_order

    # Create a payout first
    await client.post(
        f"{ADMIN_PAYOUTS}/calculate",
        json={
            "seller_id": str(fixture["seller_id"]),
            "period_start": "2026-01-01",
            "period_end": "2026-12-31",
        },
        headers=admin_user["headers"],
    )

    # Seller lists own payouts
    resp = await client.get(SELLER_PAYOUTS, headers=fixture["seller_headers"])
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) >= 1
    assert all(r["seller_id"] == str(fixture["seller_id"]) for r in items)
```

### Step 12: Run tests to confirm failures

```bash
cd D:\bazaar\backend
python -m pytest tests/test_payouts.py -v
```

Expected: 4 failures (endpoints don't exist yet).

### Step 13: Create `backend/app/services/__init__.py`

Empty file:
```python
```

### Step 14: Create `backend/app/schemas/payout.py`

```python
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel


class PayoutCalculateRequest(BaseModel):
    seller_id: Optional[uuid.UUID] = None
    period_start: date
    period_end: date


class MarkPaidRequest(BaseModel):
    bank_ref: str


class PayoutLineItemResponse(BaseModel):
    id: uuid.UUID
    order_id: Optional[uuid.UUID] = None
    order_total: float
    commission_rate: float
    commission_amount: float
    processing_fee: float
    seller_payout: float


class PayoutRecordResponse(BaseModel):
    id: uuid.UUID
    seller_id: uuid.UUID
    period_start: date
    period_end: date
    gross_amount: float
    commission_amount: float
    processing_fees: float
    net_amount: float
    status: str
    bank_ref: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: datetime
    line_items: List[PayoutLineItemResponse] = []


class PaginatedPayouts(BaseModel):
    items: List[PayoutRecordResponse]
    total: int
    page: int
    pages: int
```

### Step 15: Create `backend/app/services/commission.py`

```python
from datetime import date
from typing import Optional
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import Category, Product, ProductVariant
from app.models.order import Order, OrderLineItem
from app.models.payout import PayoutLineItem, PayoutRecord
from app.models.user import SellerProfile

DEFAULT_COMMISSION_RATE = 7.0
PROCESSING_FEE_RATE = 0.015


async def calculate_payout(
    seller_id: uuid.UUID,
    period_start: date,
    period_end: date,
    db: AsyncSession,
) -> Optional[PayoutRecord]:
    """
    Find all completed orders for a seller in the period that don't yet have a
    payout line item, compute commission + processing fee, build and return a
    PayoutRecord (not committed — caller commits).
    Returns None if there are no qualifying orders.
    """
    # Already-paid order IDs for this seller
    paid_order_ids = set(
        (
            await db.execute(
                select(PayoutLineItem.order_id)
                .join(PayoutRecord, PayoutLineItem.payout_id == PayoutRecord.id)
                .where(PayoutRecord.seller_id == seller_id)
            )
        )
        .scalars()
        .all()
    )

    # Completed orders in the period
    orders = (
        await db.execute(
            select(Order).where(
                Order.seller_id == seller_id,
                Order.status == "completed",
                Order.created_at >= period_start,
                Order.created_at <= period_end,
            )
        )
    ).scalars().all()

    qualifying = [o for o in orders if o.id not in paid_order_ids]
    if not qualifying:
        return None

    # Get seller commission_override if set
    sp = (
        await db.execute(select(SellerProfile).where(SellerProfile.user_id == seller_id))
    ).scalar_one_or_none()
    seller_override = float(sp.commission_override) if sp and sp.commission_override is not None else None

    line_item_data = []
    gross_total = 0.0
    commission_total = 0.0
    processing_total = 0.0

    for order in qualifying:
        order_total = float(order.total_amount)

        # Determine commission rate: seller override > category rate > default
        if seller_override is not None:
            rate = seller_override
        else:
            rate = await _get_category_rate(order.id, db)

        commission_amount = order_total * rate / 100
        processing_fee = order_total * PROCESSING_FEE_RATE
        seller_payout = order_total - commission_amount - processing_fee

        gross_total += order_total
        commission_total += commission_amount
        processing_total += processing_fee

        line_item_data.append({
            "order_id": order.id,
            "order_total": order_total,
            "commission_rate": rate,
            "commission_amount": commission_amount,
            "processing_fee": processing_fee,
            "seller_payout": seller_payout,
        })

    net_total = gross_total - commission_total - processing_total

    payout = PayoutRecord(
        seller_id=seller_id,
        period_start=period_start,
        period_end=period_end,
        gross_amount=gross_total,
        commission_amount=commission_total,
        processing_fees=processing_total,
        penalties=0,
        net_amount=net_total,
        status="pending",
    )
    db.add(payout)
    await db.flush()

    for item in line_item_data:
        db.add(PayoutLineItem(
            payout_id=payout.id,
            order_id=item["order_id"],
            order_total=item["order_total"],
            commission_rate=item["commission_rate"],
            commission_amount=item["commission_amount"],
            processing_fee=item["processing_fee"],
            seller_payout=item["seller_payout"],
        ))

    return payout


async def _get_category_rate(order_id: uuid.UUID, db: AsyncSession) -> float:
    """Walk order → line item → variant → product → category to get commission_rate."""
    line_items = (
        await db.execute(select(OrderLineItem).where(OrderLineItem.order_id == order_id))
    ).scalars().all()

    for li in line_items:
        if li.variant_id is None:
            continue
        variant = (
            await db.execute(select(ProductVariant).where(ProductVariant.id == li.variant_id))
        ).scalar_one_or_none()
        if variant is None:
            continue
        product = (
            await db.execute(select(Product).where(Product.id == variant.product_id))
        ).scalar_one_or_none()
        if product is None or product.category_id is None:
            continue
        category = (
            await db.execute(select(Category).where(Category.id == product.category_id))
        ).scalar_one_or_none()
        if category:
            return float(category.commission_rate)

    return DEFAULT_COMMISSION_RATE
```

### Step 16: Add payout endpoints to `backend/app/routers/admin.py`

Append to the bottom of the existing `admin.py` (keep all existing code, add these):

```python
# Add to imports at top of admin.py:
import math
from datetime import datetime, timezone
from sqlalchemy import select
from app.models.order import Order
from app.models.payout import PayoutRecord, PayoutLineItem
from app.schemas.payout import (
    MarkPaidRequest,
    PaginatedPayouts,
    PayoutCalculateRequest,
    PayoutLineItemResponse,
    PayoutRecordResponse,
)
from app.services.commission import calculate_payout


# Add these routes at the bottom of admin.py:

@router.post("/payouts/calculate")
async def admin_calculate_payouts(
    payload: PayoutCalculateRequest,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import distinct
    results = []

    if payload.seller_id:
        seller_ids = [payload.seller_id]
    else:
        # All sellers with completed orders in period
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

    data_q = select(PayoutRecord).order_by(PayoutRecord.created_at.desc()).offset((page - 1) * limit).limit(limit)
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
        ],
    )
```

**Important:** The `_payout_to_response` helper and the new imports must be added carefully. The helper uses `r.line_items` but by default SQLAlchemy won't have loaded them. Use `selectinload` when fetching individual records for the mark-paid endpoint, or use `await db.refresh(record)` + explicit load. For the list endpoint we don't need line_items. Update `_payout_to_response` to handle lazy line_items with `line_items=[]` for list, full list for detail.

**Revised approach:** Keep `_payout_to_response` simple — include `line_items=[]` always at list level, and add a `GET /payouts/{id}` endpoint that loads line items via `selectinload`.

### Step 17: Create `backend/app/routers/payouts.py`

```python
import math
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_seller
from app.models.payout import PayoutRecord
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
```

### Step 18: Wire payouts router into `backend/app/main.py`

```python
# Add to imports:
from app.routers import payouts as payouts_router

# Add to router registrations:
app.include_router(payouts_router.router, prefix="/v1")
```

### Step 19: Run payout tests

```bash
cd D:\bazaar\backend
python -m pytest tests/test_payouts.py -v
```

Expected: 4 passed.

### Step 20: Run full suite — must be 78 green

```bash
python -m pytest tests/ -q
```

Expected: 78 passed.

---

## Final verification

```bash
cd D:\bazaar\backend
python -m pytest tests/ -v --cov=app --cov-report=term-missing
```

Paste full output including coverage %.

---

## Common pitfalls

1. **`_payout_to_response` in admin.py vs payouts.py** — both files define their own helper. That's fine; they can diverge. Alternatively, move to `schemas/payout.py` as a method, but that's a premature abstraction.

2. **`Order.delivery_address` is JSONB not-nullable** — the RFQ accept endpoint sets it to `{"city": rfq.delivery_city}` or `{}`. Either works since JSONB accepts empty dict.

3. **`Order.rfq_id` has no FK constraint** — that's by design in the model. We store `quote.id` per spec. No migration needed.

4. **`require_buyer` vs `get_current_active_user`** — `require_buyer` checks `role in (consumer, business_buyer)`. For the RFQ list endpoint, sellers also need access, so use `get_current_active_user` there and branch on role inside.

5. **`selectinload` for `rfq.quotes`** — needed in `GET /rfqs/{id}` to avoid N+1. Already included in the router code above.

6. **Test cleanup order** — always delete child records (PayoutLineItem, Order) before parent (PayoutRecord, User). See fixture teardown in test_payouts.py.

7. **`calculate_payout` in admin route** — the `period_start`/`period_end` are `date` objects but `Order.created_at` is a `datetime`. SQLAlchemy will coerce `date` comparisons correctly in PostgreSQL.

8. **Idempotency of calculate** — running calculate twice for the same seller+period should NOT create duplicate PayoutRecords. The commission service skips orders that already have a PayoutLineItem. So running twice creates a second PayoutRecord with 0 orders → returns nothing (None). The endpoint just skips None results. This is the correct behavior.
