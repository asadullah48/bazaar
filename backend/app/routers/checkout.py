import uuid
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.models.catalog import CartItem, Product, ProductImage, ProductVariant
from app.models.order import (
    CheckoutSession,
    Order,
    OrderLineItem,
    OrderStatusHistory,
)
from app.models.user import User
from app.schemas.order import (
    CheckoutRequest,
    CheckoutResponse,
    OrderLineItemResponse,
    OrderResponse,
)

router = APIRouter(tags=["checkout"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _order_number() -> str:
    year = datetime.now().year
    return f"BZR-{year}-{uuid.uuid4().hex[:6].upper()}"


def _initial_status(payment_method: str) -> str:
    if payment_method in ("cod", "bank_transfer"):
        return "payment_confirmed"
    return "pending_payment"


@router.post("/checkout", response_model=CheckoutResponse)
async def checkout(
    payload: CheckoutRequest,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Load cart items with variant + product info
    cart_rows = (
        await db.execute(
            select(
                CartItem.id.label("cart_id"),
                CartItem.variant_id,
                CartItem.quantity,
                CartItem.is_b2b,
                ProductVariant.price,
                ProductVariant.sku_code,
                ProductVariant.option1_name,
                ProductVariant.option1_value,
                ProductVariant.option2_name,
                ProductVariant.option2_value,
                Product.id.label("product_id"),
                Product.title,
                Product.seller_id,
            )
            .join(ProductVariant, CartItem.variant_id == ProductVariant.id)
            .join(Product, ProductVariant.product_id == Product.id)
            .where(CartItem.user_id == user.id)
        )
    ).all()

    if not cart_rows:
        raise HTTPException(status_code=400, detail="Cart is empty")

    # 2. Group by seller
    seller_groups: dict[uuid.UUID, list] = defaultdict(list)
    for row in cart_rows:
        seller_groups[row.seller_id].append(row)

    # Fetch primary images for all products
    all_product_ids = list({r.product_id for r in cart_rows})
    img_rows = (
        await db.execute(
            select(ProductImage.product_id, ProductImage.url)
            .where(
                ProductImage.product_id.in_(all_product_ids),
                ProductImage.is_primary == True,
            )
        )
    ).all()
    image_map = {r.product_id: r.url for r in img_rows}

    # 3. Create CheckoutSession placeholder (get id before creating orders)
    session = CheckoutSession(
        buyer_id=user.id,
        address_snapshot=payload.address,
        payment_method=payload.payment_method,
        total_amount=0,
    )
    db.add(session)
    await db.flush()

    initial_status = _initial_status(payload.payment_method)
    grand_total = 0.0
    created_orders: list[dict] = []

    # 4. Process each seller group in the same transaction
    for seller_id, group in seller_groups.items():
        variant_ids = [r.variant_id for r in group]

        # Pessimistic lock on variants
        locked = (
            await db.execute(
                select(ProductVariant)
                .where(ProductVariant.id.in_(variant_ids))
                .with_for_update()
            )
        ).scalars().all()
        variant_map = {v.id: v for v in locked}

        # Validate and deduct stock
        for row in group:
            var = variant_map[row.variant_id]
            if var.stock_qty < row.quantity:
                raise HTTPException(
                    status_code=409,
                    detail=f"Insufficient stock for '{row.title}' (available: {var.stock_qty})",
                )
            var.stock_qty -= row.quantity

        subtotal = sum(
            float(variant_map[r.variant_id].price) * r.quantity for r in group
        )
        grand_total += subtotal

        order = Order(
            order_number=_order_number(),
            checkout_session_id=session.id,
            buyer_id=user.id,
            seller_id=seller_id,
            payment_method=payload.payment_method,
            payment_status="pending",
            subtotal=subtotal,
            shipping_cost=0,
            discount_amount=0,
            total_amount=subtotal,
            currency="PKR",
            delivery_address=payload.address,
            status=initial_status,
            is_b2b=any(r.is_b2b for r in group),
            payment_terms=payload.payment_terms,
        )
        db.add(order)
        await db.flush()  # get order.id

        line_items_data = []
        for row in group:
            var = variant_map[row.variant_id]
            snapshot = {
                "title": row.title,
                "sku_code": var.sku_code,
                "option1_name": row.option1_name,
                "option1_value": row.option1_value,
                "option2_name": row.option2_name,
                "option2_value": row.option2_value,
                "image_url": image_map.get(row.product_id),
            }
            li = OrderLineItem(
                order_id=order.id,
                variant_id=row.variant_id,
                product_snapshot=snapshot,
                quantity=row.quantity,
                unit_price=float(var.price),
            )
            db.add(li)
            line_items_data.append({
                "variant_id": row.variant_id,
                "product_snapshot": snapshot,
                "quantity": row.quantity,
                "unit_price": float(var.price),
                "line_total": float(var.price) * row.quantity,
            })

        db.add(
            OrderStatusHistory(
                order_id=order.id,
                from_status=None,
                to_status=initial_status,
                changed_by=user.id,
            )
        )

        created_orders.append({
            "id": order.id,
            "order_number": order.order_number,
            "seller_id": order.seller_id,
            "buyer_id": order.buyer_id,
            "status": order.status,
            "payment_method": order.payment_method,
            "subtotal": subtotal,
            "shipping_cost": 0.0,
            "total_amount": subtotal,
            "delivery_address": payload.address,
            "created_at": _utcnow(),
            "items": line_items_data,
        })

    # 5. Update session total
    session.total_amount = grand_total

    # 6. Clear cart
    await db.execute(delete(CartItem).where(CartItem.user_id == user.id))

    await db.commit()

    return CheckoutResponse(
        orders=[OrderResponse(**o) for o in created_orders],
        total_orders=len(created_orders),
    )
