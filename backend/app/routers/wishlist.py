import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.models.catalog import Product, ProductVariant, Wishlist
from app.models.user import User
from app.schemas.wishlist import WishlistItem

router = APIRouter(tags=["wishlist"])


def _min_price_sq():
    return (
        select(
            ProductVariant.product_id,
            func.min(ProductVariant.price).label("min_price"),
        )
        .where(ProductVariant.is_active == True)
        .group_by(ProductVariant.product_id)
        .subquery()
    )


@router.get("/wishlist", response_model=List[WishlistItem])
async def get_wishlist(
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    mp_sq = _min_price_sq()
    rows = (
        await db.execute(
            select(Wishlist, Product, mp_sq.c.min_price)
            .join(Product, Wishlist.product_id == Product.id)
            .outerjoin(mp_sq, Product.id == mp_sq.c.product_id)
            .where(Wishlist.user_id == user.id)
            .order_by(Wishlist.added_at.desc())
        )
    ).all()
    return [
        WishlistItem(
            product_id=row.Wishlist.product_id,
            title=row.Product.title,
            slug=row.Product.slug,
            min_price=float(row.min_price) if row.min_price is not None else None,
            added_at=row.Wishlist.added_at,
            is_available=row.Product.status == "published",
        )
        for row in rows
    ]


@router.post("/wishlist/{product_id}", status_code=201)
async def add_to_wishlist(
    product_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    product = (
        await db.execute(select(Product).where(Product.id == product_id))
    ).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = (
        await db.execute(
            select(Wishlist).where(
                Wishlist.user_id == user.id,
                Wishlist.product_id == product_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Product already in wishlist")

    item = Wishlist(user_id=user.id, product_id=product_id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {"product_id": str(product_id), "added_at": item.added_at}


@router.delete("/wishlist/{product_id}", status_code=204)
async def remove_from_wishlist(
    product_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    item = (
        await db.execute(
            select(Wishlist).where(
                Wishlist.user_id == user.id,
                Wishlist.product_id == product_id,
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Product not in wishlist")

    await db.delete(item)
    await db.commit()
