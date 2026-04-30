import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.models.catalog import CartItem, Product, ProductImage, ProductVariant
from app.models.user import User
from app.schemas.cart import CartItemAdd, CartItemResponse, CartItemUpdate, CartResponse

router = APIRouter(tags=["cart"])


async def _cart_response(user_id: uuid.UUID, db: AsyncSession) -> CartResponse:
    rows = (
        await db.execute(
            select(
                CartItem.id.label("cart_id"),
                CartItem.variant_id,
                CartItem.quantity,
                CartItem.is_b2b,
                ProductVariant.price,
                ProductVariant.option1_name,
                ProductVariant.option1_value,
                ProductVariant.option2_name,
                ProductVariant.option2_value,
                Product.id.label("product_id"),
                Product.title,
            )
            .join(ProductVariant, CartItem.variant_id == ProductVariant.id)
            .join(Product, ProductVariant.product_id == Product.id)
            .where(CartItem.user_id == user_id)
            .order_by(CartItem.added_at)
        )
    ).all()

    if not rows:
        return CartResponse(items=[], subtotal=0.0, item_count=0)

    product_ids = list({r.product_id for r in rows})
    img_rows = (
        await db.execute(
            select(ProductImage.product_id, ProductImage.url)
            .where(
                ProductImage.product_id.in_(product_ids),
                ProductImage.is_primary == True,
            )
        )
    ).all()
    image_map = {r.product_id: r.url for r in img_rows}

    items = [
        CartItemResponse(
            id=r.cart_id,
            variant_id=r.variant_id,
            product_id=r.product_id,
            title=r.title,
            image_url=image_map.get(r.product_id),
            option1_name=r.option1_name,
            option1_value=r.option1_value,
            option2_name=r.option2_name,
            option2_value=r.option2_value,
            price=float(r.price),
            quantity=r.quantity,
            is_b2b=r.is_b2b,
            line_total=float(r.price) * r.quantity,
        )
        for r in rows
    ]

    return CartResponse(
        items=items,
        subtotal=sum(i.line_total for i in items),
        item_count=sum(i.quantity for i in items),
    )


@router.post("/cart/items", response_model=CartResponse)
async def add_to_cart(
    payload: CartItemAdd,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    row = (
        await db.execute(
            select(ProductVariant, Product)
            .join(Product, ProductVariant.product_id == Product.id)
            .where(ProductVariant.id == payload.variant_id)
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Variant not found")
    variant, product = row.ProductVariant, row.Product
    if not variant.is_active:
        raise HTTPException(status_code=400, detail="Variant is not available")
    if product.status != "published":
        raise HTTPException(status_code=400, detail="Product is not available")

    existing = (
        await db.execute(
            select(CartItem).where(
                CartItem.user_id == user.id,
                CartItem.variant_id == payload.variant_id,
                CartItem.is_b2b == payload.is_b2b,
            )
        )
    ).scalar_one_or_none()

    if existing:
        new_qty = existing.quantity + payload.quantity
        if new_qty > variant.stock_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Only {variant.stock_qty} units available (already {existing.quantity} in cart)",
            )
        existing.quantity = new_qty
    else:
        if payload.quantity > variant.stock_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Only {variant.stock_qty} units available",
            )
        db.add(
            CartItem(
                user_id=user.id,
                variant_id=payload.variant_id,
                quantity=payload.quantity,
                is_b2b=payload.is_b2b,
            )
        )

    await db.commit()
    return await _cart_response(user.id, db)


@router.get("/cart", response_model=CartResponse)
async def get_cart(
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    return await _cart_response(user.id, db)


@router.put("/cart/items/{item_id}", response_model=CartResponse)
async def update_cart_item(
    item_id: uuid.UUID,
    payload: CartItemUpdate,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    item = (
        await db.execute(
            select(CartItem).where(CartItem.id == item_id, CartItem.user_id == user.id)
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Cart item not found")

    variant = (
        await db.execute(select(ProductVariant).where(ProductVariant.id == item.variant_id))
    ).scalar_one_or_none()
    if variant and payload.quantity > variant.stock_qty:
        raise HTTPException(
            status_code=400,
            detail=f"Only {variant.stock_qty} units available",
        )

    item.quantity = payload.quantity
    await db.commit()
    return await _cart_response(user.id, db)


@router.delete("/cart/items/{item_id}", response_model=CartResponse)
async def remove_cart_item(
    item_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    item = (
        await db.execute(
            select(CartItem).where(CartItem.id == item_id, CartItem.user_id == user.id)
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Cart item not found")

    await db.delete(item)
    await db.commit()
    return await _cart_response(user.id, db)


@router.delete("/cart", response_model=CartResponse)
async def clear_cart(
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(delete(CartItem).where(CartItem.user_id == user.id))
    await db.commit()
    return CartResponse(items=[], subtotal=0.0, item_count=0)
