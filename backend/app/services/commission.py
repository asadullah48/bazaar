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
    Find completed orders for a seller in the period without an existing payout
    line item, compute commission + processing fee, return a PayoutRecord.
    Caller is responsible for committing. Returns None if no qualifying orders.
    """
    # Order IDs already covered by a previous payout for this seller
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
