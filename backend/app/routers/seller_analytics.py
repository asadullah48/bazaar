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
