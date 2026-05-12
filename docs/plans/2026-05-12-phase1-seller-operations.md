# Phase 1 — Seller Operations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add inventory management, payout scheduling, and analytics to the seller dashboard.

**Architecture:** New `InventoryAlert` + `StockMovement` models extend the existing `ProductVariant` (which already has `stock_qty` + `low_stock_threshold`). Payouts build on existing `PayoutRecord` + `PayoutLineItem` by adding a `SellerPayoutSchedule` config model. Analytics are read-only aggregation endpoints over existing `Order` + `OrderLineItem` data. All three get new FastAPI routers registered in `main.py` and new Next.js pages under `/seller/`.

**Tech Stack:** FastAPI, SQLAlchemy async, PostgreSQL, Alembic, Next.js 14, next-intl, Tailwind CSS, pytest-asyncio, httpx

---

## Task 1: Inventory models — `InventoryAlert` + `StockMovement`

**Files:**
- Modify: `backend/app/models/catalog.py`

**Step 1: Add models at the bottom of catalog.py**

```python
class InventoryAlert(Base):
    __tablename__ = "inventory_alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    variant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="CASCADE"), unique=True)
    threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    auto_pause: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    variant: Mapped["ProductVariant"] = relationship()


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    variant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="CASCADE"))
    changed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(50), nullable=False)  # "sale", "restock", "adjustment", "correction"
    note: Mapped[str | None] = mapped_column(Text)
    qty_after: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    variant: Mapped["ProductVariant"] = relationship()
```

**Step 2: Generate + apply migration**

```bash
cd backend
source .venv/Scripts/activate
alembic revision --autogenerate -m "add inventory_alerts and stock_movements"
alembic upgrade head
```

Expected: migration creates two new tables, zero errors.

**Step 3: Commit**

```bash
git add backend/app/models/catalog.py backend/alembic/versions/
git commit -m "feat(inventory): add InventoryAlert and StockMovement models"
```

---

## Task 2: Payout schedule model

**Files:**
- Modify: `backend/app/models/payout.py`

**Step 1: Add `SellerPayoutSchedule` at the bottom of payout.py**

```python
class SellerPayoutSchedule(Base):
    __tablename__ = "seller_payout_schedules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    seller_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    frequency: Mapped[str] = mapped_column(String(20), default="weekly")  # "weekly" | "biweekly"
    bank_name: Mapped[str | None] = mapped_column(String(100))
    account_number: Mapped[str | None] = mapped_column(String(50))
    account_title: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
```

**Step 2: Migrate**

```bash
alembic revision --autogenerate -m "add seller_payout_schedules"
alembic upgrade head
```

**Step 3: Commit**

```bash
git add backend/app/models/payout.py backend/alembic/versions/
git commit -m "feat(payouts): add SellerPayoutSchedule model"
```

---

## Task 3: Inventory schemas

**Files:**
- Create: `backend/app/schemas/inventory.py`

**Step 1: Write the schemas**

```python
import uuid
from pydantic import BaseModel, Field
from datetime import datetime


class AlertUpsert(BaseModel):
    threshold: int = Field(ge=0)
    auto_pause: bool = True
    is_active: bool = True


class AlertResponse(BaseModel):
    id: uuid.UUID
    variant_id: uuid.UUID
    threshold: int
    auto_pause: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class StockAdjust(BaseModel):
    delta: int  # positive = restock, negative = correction
    reason: str = Field(pattern="^(restock|adjustment|correction)$")
    note: str | None = None


class StockMovementResponse(BaseModel):
    id: uuid.UUID
    variant_id: uuid.UUID
    delta: int
    reason: str
    note: str | None
    qty_after: int
    created_at: datetime

    model_config = {"from_attributes": True}


class VariantInventoryRow(BaseModel):
    variant_id: uuid.UUID
    product_title: str
    sku_code: str | None
    option1_name: str | None
    option1_value: str | None
    stock_qty: int
    threshold: int | None
    auto_pause: bool | None
    is_active: bool

    model_config = {"from_attributes": True}
```

**Step 2: Commit**

```bash
git add backend/app/schemas/inventory.py
git commit -m "feat(inventory): add inventory schemas"
```

---

## Task 4: Inventory router

**Files:**
- Create: `backend/app/routers/inventory.py`

**Step 1: Write the router**

```python
import csv
import io
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_seller
from app.models.catalog import InventoryAlert, ProductVariant, Product, StockMovement
from app.models.user import User
from app.schemas.inventory import (
    AlertUpsert, AlertResponse, StockAdjust, StockMovementResponse, VariantInventoryRow
)

router = APIRouter(prefix="/seller/inventory", tags=["seller-inventory"])


async def _seller_variant(variant_id: uuid.UUID, seller: User, db: AsyncSession) -> ProductVariant:
    result = await db.execute(
        select(ProductVariant)
        .join(Product, ProductVariant.product_id == Product.id)
        .where(ProductVariant.id == variant_id, Product.seller_id == seller.id)
    )
    v = result.scalar_one_or_none()
    if v is None:
        raise HTTPException(404, "Variant not found or not owned by seller")
    return v


@router.get("", response_model=list[VariantInventoryRow])
async def list_inventory(
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(ProductVariant, Product.title, InventoryAlert)
        .join(Product, ProductVariant.product_id == Product.id)
        .outerjoin(InventoryAlert, InventoryAlert.variant_id == ProductVariant.id)
        .where(Product.seller_id == seller.id)
        .order_by(Product.title, ProductVariant.option1_value)
    )
    result = []
    for variant, title, alert in rows:
        result.append(VariantInventoryRow(
            variant_id=variant.id,
            product_title=title,
            sku_code=variant.sku_code,
            option1_name=variant.option1_name,
            option1_value=variant.option1_value,
            stock_qty=variant.stock_qty,
            threshold=alert.threshold if alert else None,
            auto_pause=alert.auto_pause if alert else None,
            is_active=variant.is_active,
        ))
    return result


@router.put("/{variant_id}/alert", response_model=AlertResponse)
async def upsert_alert(
    variant_id: uuid.UUID,
    body: AlertUpsert,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    await _seller_variant(variant_id, seller, db)
    result = await db.execute(select(InventoryAlert).where(InventoryAlert.variant_id == variant_id))
    alert = result.scalar_one_or_none()
    if alert is None:
        alert = InventoryAlert(variant_id=variant_id, **body.model_dump())
        db.add(alert)
    else:
        for k, v in body.model_dump().items():
            setattr(alert, k, v)
    await db.commit()
    await db.refresh(alert)
    return alert


@router.post("/{variant_id}/adjust", response_model=StockMovementResponse)
async def adjust_stock(
    variant_id: uuid.UUID,
    body: StockAdjust,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    variant = await _seller_variant(variant_id, seller, db)
    new_qty = variant.stock_qty + body.delta
    if new_qty < 0:
        raise HTTPException(400, "Stock cannot go below 0")
    variant.stock_qty = new_qty

    result = await db.execute(select(InventoryAlert).where(InventoryAlert.variant_id == variant_id))
    alert = result.scalar_one_or_none()
    if alert and alert.auto_pause and new_qty == 0:
        variant.is_active = False

    movement = StockMovement(
        variant_id=variant_id,
        changed_by=seller.id,
        delta=body.delta,
        reason=body.reason,
        note=body.note,
        qty_after=new_qty,
    )
    db.add(movement)
    await db.commit()
    await db.refresh(movement)
    return movement


@router.get("/export")
async def export_inventory(
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(ProductVariant, Product.title)
        .join(Product, ProductVariant.product_id == Product.id)
        .where(Product.seller_id == seller.id)
        .order_by(Product.title)
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["product_title", "sku_code", "option1_name", "option1_value",
                     "stock_qty", "low_stock_threshold", "is_active"])
    for variant, title in rows:
        writer.writerow([title, variant.sku_code or "", variant.option1_name or "",
                         variant.option1_value or "", variant.stock_qty,
                         variant.low_stock_threshold, variant.is_active])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=inventory.csv"},
    )
```

**Step 2: Commit**

```bash
git add backend/app/routers/inventory.py
git commit -m "feat(inventory): add inventory router with list, alert upsert, adjust, export"
```

---

## Task 5: Register inventory router in main.py

**Files:**
- Modify: `backend/app/main.py`

**Step 1: Add import after existing router imports**

```python
from app.routers import inventory as inventory_router
```

**Step 2: Register after `wishlist_router` line**

```python
app.include_router(inventory_router.router, prefix="/v1")
```

**Step 3: Verify server starts**

```bash
uvicorn app.main:app --reload --port 8000
```

Expected: server starts, `/docs` shows `/v1/seller/inventory` endpoints.

**Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(inventory): register inventory router"
```

---

## Task 6: Inventory tests

**Files:**
- Create: `backend/tests/test_inventory.py`

**Step 1: Write tests**

```python
import uuid
import pytest
from httpx import ASGITransport, AsyncClient

from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.catalog import Category, Product, ProductVariant
from app.models.user import User
from tests.conftest import _TestSession

BASE = "/v1/seller/inventory"


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def _make_seller_with_variant() -> tuple[str, uuid.UUID, uuid.UUID]:
    seller_id = uuid.uuid4()
    async with _TestSession() as db:
        db.add(User(id=seller_id, email=f"seller_{seller_id.hex[:6]}@test.dev",
                    password_hash=hash_password("Pass123!"), role="seller"))
        cat = Category(name="Test", slug=f"test-{seller_id.hex[:6]}")
        db.add(cat)
        await db.flush()
        product = Product(seller_id=seller_id, category_id=cat.id,
                          title="Test Product", slug=f"slug-{seller_id.hex[:6]}")
        db.add(product)
        await db.flush()
        variant = ProductVariant(product_id=product.id, price=100, stock_qty=20)
        db.add(variant)
        await db.commit()
        return create_access_token(str(seller_id), "seller"), seller_id, variant.id


@pytest.mark.anyio
async def test_list_inventory_returns_variants(client):
    token, _, variant_id = await _make_seller_with_variant()
    r = await client.get(BASE, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    ids = [row["variant_id"] for row in r.json()]
    assert str(variant_id) in ids


@pytest.mark.anyio
async def test_upsert_alert_creates_then_updates(client):
    token, _, variant_id = await _make_seller_with_variant()
    r = await client.put(f"{BASE}/{variant_id}/alert",
                         json={"threshold": 3, "auto_pause": True, "is_active": True},
                         headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["threshold"] == 3

    r2 = await client.put(f"{BASE}/{variant_id}/alert",
                          json={"threshold": 10, "auto_pause": False, "is_active": True},
                          headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    assert r2.json()["threshold"] == 10


@pytest.mark.anyio
async def test_adjust_stock_records_movement(client):
    token, _, variant_id = await _make_seller_with_variant()
    r = await client.post(f"{BASE}/{variant_id}/adjust",
                          json={"delta": -5, "reason": "correction", "note": "damaged"},
                          headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["qty_after"] == 15
    assert r.json()["delta"] == -5


@pytest.mark.anyio
async def test_adjust_stock_cannot_go_negative(client):
    token, _, variant_id = await _make_seller_with_variant()
    r = await client.post(f"{BASE}/{variant_id}/adjust",
                          json={"delta": -999, "reason": "correction"},
                          headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 400


@pytest.mark.anyio
async def test_auto_pause_on_zero_stock(client):
    token, _, variant_id = await _make_seller_with_variant()
    await client.put(f"{BASE}/{variant_id}/alert",
                     json={"threshold": 5, "auto_pause": True, "is_active": True},
                     headers={"Authorization": f"Bearer {token}"})
    r = await client.post(f"{BASE}/{variant_id}/adjust",
                          json={"delta": -20, "reason": "correction"},
                          headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    rows = (await client.get(BASE, headers={"Authorization": f"Bearer {token}"})).json()
    row = next(r for r in rows if r["variant_id"] == str(variant_id))
    assert row["is_active"] is False


@pytest.mark.anyio
async def test_export_returns_csv(client):
    token, _, _ = await _make_seller_with_variant()
    r = await client.get(f"{BASE}/export", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    assert "product_title" in r.text
```

**Step 2: Run tests**

```bash
cd backend
pytest tests/test_inventory.py -v
```

Expected: 6 tests pass.

**Step 3: Commit**

```bash
git add backend/tests/test_inventory.py
git commit -m "test(inventory): add inventory endpoint tests"
```

---

## Task 7: Payout schedule router

**Files:**
- Create: `backend/app/schemas/payout_schedule.py`
- Create: `backend/app/routers/payout_schedule.py`

**Step 1: Write schemas**

```python
# backend/app/schemas/payout_schedule.py
import uuid
from pydantic import BaseModel, Field
from datetime import datetime


class ScheduleUpsert(BaseModel):
    frequency: str = Field(pattern="^(weekly|biweekly)$")
    bank_name: str | None = None
    account_number: str | None = None
    account_title: str | None = None


class ScheduleResponse(BaseModel):
    id: uuid.UUID
    seller_id: uuid.UUID
    frequency: str
    bank_name: str | None
    account_number: str | None
    account_title: str | None
    is_active: bool
    updated_at: datetime

    model_config = {"from_attributes": True}
```

**Step 2: Write router**

```python
# backend/app/routers/payout_schedule.py
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_seller
from app.models.payout import SellerPayoutSchedule
from app.models.user import User
from app.schemas.payout_schedule import ScheduleUpsert, ScheduleResponse

router = APIRouter(prefix="/seller/payout-schedule", tags=["seller-payouts"])


@router.get("", response_model=ScheduleResponse | None)
async def get_schedule(
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SellerPayoutSchedule).where(SellerPayoutSchedule.seller_id == seller.id)
    )
    return result.scalar_one_or_none()


@router.put("", response_model=ScheduleResponse)
async def upsert_schedule(
    body: ScheduleUpsert,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SellerPayoutSchedule).where(SellerPayoutSchedule.seller_id == seller.id)
    )
    schedule = result.scalar_one_or_none()
    if schedule is None:
        schedule = SellerPayoutSchedule(seller_id=seller.id, **body.model_dump())
        db.add(schedule)
    else:
        for k, v in body.model_dump().items():
            setattr(schedule, k, v)
    await db.commit()
    await db.refresh(schedule)
    return schedule
```

**Step 3: Register in main.py**

Add import:
```python
from app.routers import payout_schedule as payout_schedule_router
```

Add registration:
```python
app.include_router(payout_schedule_router.router, prefix="/v1")
```

**Step 4: Commit**

```bash
git add backend/app/routers/payout_schedule.py backend/app/schemas/payout_schedule.py backend/app/main.py
git commit -m "feat(payouts): add payout schedule upsert endpoint"
```

---

## Task 8: Seller analytics endpoint

**Files:**
- Create: `backend/app/routers/seller_analytics.py`

**Step 1: Write the router**

```python
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_seller
from app.models.order import Order, OrderLineItem
from app.models.catalog import Product, ProductVariant
from app.models.user import User

router = APIRouter(prefix="/seller/analytics", tags=["seller-analytics"])


@router.get("/summary")
async def revenue_summary(
    days: int = Query(default=30, ge=1, le=365),
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)

    total = await db.execute(
        select(func.coalesce(func.sum(Order.total_amount), 0))
        .where(Order.seller_id == seller.id, Order.created_at >= since,
               Order.payment_status == "paid")
    )
    order_count = await db.execute(
        select(func.count(Order.id))
        .where(Order.seller_id == seller.id, Order.created_at >= since)
    )
    top_products = await db.execute(
        select(Product.title, func.sum(OrderLineItem.quantity).label("units_sold"))
        .join(ProductVariant, OrderLineItem.variant_id == ProductVariant.id)
        .join(Product, ProductVariant.product_id == Product.id)
        .join(Order, OrderLineItem.order_id == Order.id)
        .where(Product.seller_id == seller.id, Order.created_at >= since)
        .group_by(Product.id, Product.title)
        .order_by(func.sum(OrderLineItem.quantity).desc())
        .limit(5)
    )

    return {
        "period_days": days,
        "total_revenue": float(total.scalar()),
        "order_count": order_count.scalar(),
        "top_products": [{"title": r.title, "units_sold": r.units_sold} for r in top_products],
    }
```

**Step 2: Register in main.py**

```python
from app.routers import seller_analytics as seller_analytics_router
# ...
app.include_router(seller_analytics_router.router, prefix="/v1")
```

**Step 3: Commit**

```bash
git add backend/app/routers/seller_analytics.py backend/app/main.py
git commit -m "feat(analytics): add seller revenue summary endpoint"
```

---

## Task 9: Frontend — `/seller/inventory` page

**Files:**
- Create: `frontend/src/app/[locale]/seller/inventory/page.tsx`

```tsx
"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface InventoryRow {
  variant_id: string;
  product_title: string;
  sku_code: string | null;
  option1_name: string | null;
  option1_value: string | null;
  stock_qty: number;
  threshold: number | null;
  auto_pause: boolean | null;
  is_active: boolean;
}

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/v1/seller/inventory")
      .then((r) => r.json())
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const exportCsv = () => {
    window.open(`${process.env.NEXT_PUBLIC_API_URL}/v1/seller/inventory/export`, "_blank");
  };

  if (loading) return <div className="p-8">Loading inventory...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <button onClick={exportCsv}
          className="px-4 py-2 bg-gray-100 rounded text-sm font-medium hover:bg-gray-200">
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Variant</th>
              <th className="px-4 py-3 font-medium text-right">Stock</th>
              <th className="px-4 py-3 font-medium text-right">Threshold</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.variant_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{row.product_title}</td>
                <td className="px-4 py-3 text-gray-500">{row.sku_code ?? "—"}</td>
                <td className="px-4 py-3">
                  {row.option1_name && row.option1_value
                    ? `${row.option1_name}: ${row.option1_value}` : "Default"}
                </td>
                <td className={`px-4 py-3 text-right font-mono ${
                  row.stock_qty === 0 ? "text-red-600 font-bold" :
                  row.threshold && row.stock_qty <= row.threshold ? "text-orange-500" : ""}`}>
                  {row.stock_qty}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-500">
                  {row.threshold ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    row.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {row.is_active ? "Active" : "Paused"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Commit:**
```bash
git add "frontend/src/app/[locale]/seller/inventory/page.tsx"
git commit -m "feat(frontend): add seller inventory page"
```

---

## Task 10: Frontend — `/seller/financials` page

**Files:**
- Create: `frontend/src/app/[locale]/seller/financials/page.tsx`

```tsx
"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Payout {
  id: string;
  period_start: string;
  period_end: string;
  gross_amount: number;
  commission_amount: number;
  processing_fees: number;
  net_amount: number;
  status: string;
}

interface Schedule {
  frequency: string;
  bank_name: string | null;
  account_number: string | null;
  account_title: string | null;
}

export default function FinancialsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch("/v1/seller/payouts").then((r) => r.json()),
      apiFetch("/v1/seller/payout-schedule").then((r) => r.json()),
    ]).then(([p, s]) => { setPayouts(p); setSchedule(s); })
      .finally(() => setLoading(false));
  }, []);

  const pending = payouts.find((p) => p.status === "pending");

  if (loading) return <div className="p-8">Loading financials...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Financials</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-500">Pending Payout</p>
          <p className="text-2xl font-bold mt-1">
            PKR {pending ? pending.net_amount.toLocaleString() : "0"}
          </p>
          <p className="text-xs text-gray-400 mt-1">Schedule: {schedule?.frequency ?? "not set"}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-500">Bank</p>
          <p className="text-lg font-medium mt-1">{schedule?.bank_name ?? "—"}</p>
          <p className="text-xs text-gray-400 mt-1">{schedule?.account_number ?? "—"}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-500">Account Title</p>
          <p className="text-lg font-medium mt-1">{schedule?.account_title ?? "—"}</p>
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-3">Payout History</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium text-right">Gross</th>
                <th className="px-4 py-3 font-medium text-right">Commission</th>
                <th className="px-4 py-3 font-medium text-right">Fees</th>
                <th className="px-4 py-3 font-medium text-right">Net</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payouts.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{p.period_start} → {p.period_end}</td>
                  <td className="px-4 py-3 text-right">PKR {p.gross_amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-red-500">-{p.commission_amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-red-500">-{p.processing_fees.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold">PKR {p.net_amount.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.status === "paid" ? "bg-green-100 text-green-700" :
                      p.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
              {payouts.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No payouts yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

**Commit:**
```bash
git add "frontend/src/app/[locale]/seller/financials/page.tsx"
git commit -m "feat(frontend): add seller financials page"
```

---

## Task 11: Frontend — `/seller/analytics` page

**Files:**
- Create: `frontend/src/app/[locale]/seller/analytics/page.tsx`

```tsx
"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Summary {
  period_days: number;
  total_revenue: number;
  order_count: number;
  top_products: { title: string; units_sold: number }[];
}

const PERIODS = [7, 30, 90];

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/v1/seller/analytics/summary?days=${days}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex gap-2">
          {PERIODS.map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                days === d ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>
      {loading || !data ? <div className="text-gray-400">Loading...</div> : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border p-5">
              <p className="text-sm text-gray-500">Revenue (last {days}d)</p>
              <p className="text-3xl font-bold mt-1">PKR {data.total_revenue.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border p-5">
              <p className="text-sm text-gray-500">Orders (last {days}d)</p>
              <p className="text-3xl font-bold mt-1">{data.order_count}</p>
            </div>
          </div>
          <div className="rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-600 mb-3">Top Products</h2>
            {data.top_products.length === 0
              ? <p className="text-gray-400 text-sm">No sales in this period</p>
              : <ul className="space-y-2">
                  {data.top_products.map((p, i) => (
                    <li key={p.title} className="flex items-center justify-between">
                      <span className="text-sm"><span className="text-gray-400 mr-2">#{i + 1}</span>{p.title}</span>
                      <span className="text-sm font-medium">{p.units_sold} units</span>
                    </li>
                  ))}
                </ul>}
          </div>
        </>
      )}
    </div>
  );
}
```

**Commit:**
```bash
git add "frontend/src/app/[locale]/seller/analytics/page.tsx"
git commit -m "feat(frontend): add seller analytics page"
```

---

## Task 12: Add nav links in seller layout

**Files:**
- Modify: seller layout/nav file (find with `grep -r "href.*seller" frontend/src/app/\[locale\]/seller/ --include="*.tsx" -l`)

**Step 1: Find the seller nav component**

```bash
grep -r "seller" frontend/src/app/\[locale\]/seller/ --include="*.tsx" -l
```

**Step 2: Add three nav items using the same pattern as existing items**

- `/seller/inventory` → label "Inventory"
- `/seller/financials` → label "Financials"
- `/seller/analytics` → label "Analytics"

**Step 3: Commit**

```bash
git add "frontend/src/app/[locale]/seller/"
git commit -m "feat(frontend): add inventory, financials, analytics to seller nav"
```

---

## Final check

Run the full test suite:

```bash
cd backend && pytest -v
```

Expected: all pre-existing tests pass + 6 new inventory tests pass.
