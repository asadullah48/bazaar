import math
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_active_user, require_seller
from app.models.catalog import ProductVariant
from app.models.order import Order, OrderLineItem, OrderStatusHistory
from app.models.user import User
from app.schemas.order import AdvanceOrderRequest, OrderLineItemResponse, OrderResponse, PaginatedOrders

router = APIRouter(tags=["orders"])

SELLER_TRANSITIONS = {
    "payment_confirmed": "processing",
    "processing": "packed",
    "packed": "shipped",
    "shipped": "out_for_delivery",
    "out_for_delivery": "delivered",
    "delivered": "completed",
}

BUYER_CANCELLABLE = {"payment_confirmed", "processing", "packed"}


async def _order_to_response(order: Order, db: AsyncSession) -> OrderResponse:
    items = (
        await db.execute(select(OrderLineItem).where(OrderLineItem.order_id == order.id))
    ).scalars().all()
    return OrderResponse(
        id=order.id,
        order_number=order.order_number,
        seller_id=order.seller_id,
        buyer_id=order.buyer_id,
        status=order.status,
        tracking_number=order.tracking_number,
        payment_method=order.payment_method,
        subtotal=float(order.subtotal),
        shipping_cost=float(order.shipping_cost),
        total_amount=float(order.total_amount),
        delivery_address=order.delivery_address,
        created_at=order.created_at,
        items=[
            OrderLineItemResponse(
                variant_id=li.variant_id,
                product_snapshot=li.product_snapshot,
                quantity=li.quantity,
                unit_price=float(li.unit_price),
                line_total=float(li.unit_price) * li.quantity,
            )
            for li in items
        ],
    )


# ── Buyer endpoints ───────────────────────────────────────────────────────────

@router.get("/orders", response_model=PaginatedOrders)
async def list_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    total: int = (
        await db.execute(
            select(func.count(Order.id)).where(Order.buyer_id == user.id)
        )
    ).scalar() or 0

    orders = (
        await db.execute(
            select(Order)
            .where(Order.buyer_id == user.id)
            .order_by(Order.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    ).scalars().all()

    items = [await _order_to_response(o, db) for o in orders]
    return PaginatedOrders(
        items=items,
        total=total,
        page=page,
        pages=math.ceil(total / limit) if total else 0,
    )


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    order = (
        await db.execute(
            select(Order).where(Order.id == order_id, Order.buyer_id == user.id)
        )
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return await _order_to_response(order, db)


# ── Seller endpoints ──────────────────────────────────────────────────────────

@router.get("/seller/orders", response_model=PaginatedOrders)
async def list_seller_orders(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    conditions = [Order.seller_id == seller.id]
    if status:
        conditions.append(Order.status == status)

    total: int = (
        await db.execute(select(func.count(Order.id)).where(*conditions))
    ).scalar() or 0

    orders = (
        await db.execute(
            select(Order)
            .where(*conditions)
            .order_by(Order.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    ).scalars().all()

    items = [await _order_to_response(o, db) for o in orders]
    return PaginatedOrders(
        items=items,
        total=total,
        page=page,
        pages=math.ceil(total / limit) if total else 0,
    )


@router.get("/seller/orders/{order_id}", response_model=OrderResponse)
async def get_seller_order(
    order_id: uuid.UUID,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    order = (
        await db.execute(
            select(Order).where(Order.id == order_id, Order.seller_id == seller.id)
        )
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return await _order_to_response(order, db)


@router.put("/seller/orders/{order_id}/advance", response_model=OrderResponse)
async def advance_order(
    order_id: uuid.UUID,
    body: AdvanceOrderRequest,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    order = (
        await db.execute(
            select(Order).where(Order.id == order_id, Order.seller_id == seller.id)
        )
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status not in SELLER_TRANSITIONS:
        raise HTTPException(status_code=400, detail=f"Cannot advance order from status '{order.status}'")

    next_status = SELLER_TRANSITIONS[order.status]

    if next_status == "shipped" and not body.tracking_number:
        raise HTTPException(status_code=422, detail="tracking_number is required when advancing to 'shipped'")

    from_status = order.status
    order.status = next_status
    if body.tracking_number:
        order.tracking_number = body.tracking_number

    db.add(OrderStatusHistory(
        order_id=order.id,
        from_status=from_status,
        to_status=next_status,
        changed_by=seller.id,
        note=body.note,
    ))
    await db.commit()
    await db.refresh(order)
    return await _order_to_response(order, db)


@router.put("/seller/orders/{order_id}/cancel", response_model=OrderResponse)
async def seller_accept_cancel(
    order_id: uuid.UUID,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    order = (
        await db.execute(
            select(Order).where(Order.id == order_id, Order.seller_id == seller.id)
        )
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != "cancel_requested":
        raise HTTPException(status_code=400, detail="Order is not in cancel_requested state")

    from_status = order.status
    order.status = "cancelled"

    line_items = (
        await db.execute(select(OrderLineItem).where(OrderLineItem.order_id == order.id))
    ).scalars().all()
    for li in line_items:
        if li.variant_id:
            variant = (
                await db.execute(select(ProductVariant).where(ProductVariant.id == li.variant_id))
            ).scalar_one_or_none()
            if variant:
                variant.stock_qty += li.quantity

    db.add(OrderStatusHistory(
        order_id=order.id,
        from_status=from_status,
        to_status="cancelled",
        changed_by=seller.id,
    ))
    await db.commit()
    await db.refresh(order)
    return await _order_to_response(order, db)


@router.put("/orders/{order_id}/cancel", response_model=OrderResponse)
async def buyer_cancel_order(
    order_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    order = (
        await db.execute(
            select(Order).where(Order.id == order_id, Order.buyer_id == user.id)
        )
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status not in BUYER_CANCELLABLE:
        raise HTTPException(status_code=400, detail=f"Cannot cancel order in status '{order.status}'")

    from_status = order.status
    order.status = "cancel_requested"

    db.add(OrderStatusHistory(
        order_id=order.id,
        from_status=from_status,
        to_status="cancel_requested",
        changed_by=user.id,
    ))
    await db.commit()
    await db.refresh(order)
    return await _order_to_response(order, db)
