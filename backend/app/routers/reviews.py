import math
import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.models.catalog import Product
from app.models.order import Order, OrderLineItem
from app.models.review import Review
from app.models.user import SellerProfile, User
from app.schemas.review import PaginatedReviews, ReviewCreate, ReviewResponse

router = APIRouter(tags=["reviews"])

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
_PK_PHONE_RE = re.compile(r"((\+92|0092|92|0)[0-9\s\-]{9,13})")

BLOCK_PATTERNS = [_EMAIL_RE, _PK_PHONE_RE]


def _to_response(review: Review) -> ReviewResponse:
    return ReviewResponse(
        id=review.id,
        order_id=review.order_id,
        product_id=review.product_id,
        seller_id=review.seller_id,
        buyer_id=review.buyer_id,
        rating=review.rating,
        title=review.title,
        body=review.body,
        product_accuracy=review.product_accuracy,
        packaging_quality=review.packaging_quality,
        dispatch_speed=review.dispatch_speed,
        communication=review.communication,
        helpful_count=review.helpful_count,
        created_at=review.created_at,
    )


@router.post("/reviews", response_model=ReviewResponse, status_code=201)
async def create_review(
    body: ReviewCreate,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in ("consumer", "business_buyer"):
        raise HTTPException(status_code=403, detail="Only buyers can leave reviews")

    order = (
        await db.execute(select(Order).where(Order.id == body.order_id))
    ).scalar_one_or_none()
    if order is None or order.buyer_id != user.id:
        raise HTTPException(status_code=403, detail="Order not found or not yours")
    if order.status != "completed":
        raise HTTPException(status_code=403, detail="Order must be completed before reviewing")

    line_items = (
        await db.execute(select(OrderLineItem).where(OrderLineItem.order_id == order.id))
    ).scalars().all()
    product_ids_in_order = set()
    for li in line_items:
        snap = li.product_snapshot or {}
        if "product_id" in snap:
            try:
                product_ids_in_order.add(uuid.UUID(snap["product_id"]))
            except (ValueError, AttributeError):
                pass
        if li.variant_id:
            from app.models.catalog import ProductVariant
            variant = (
                await db.execute(
                    select(ProductVariant).where(ProductVariant.id == li.variant_id)
                )
            ).scalar_one_or_none()
            if variant:
                product_ids_in_order.add(variant.product_id)

    product = (
        await db.execute(select(Product).where(Product.id == body.product_id))
    ).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=400, detail="Product not found")
    if body.product_id not in product_ids_in_order:
        raise HTTPException(status_code=400, detail="Product not found in this order")

    existing = (
        await db.execute(
            select(Review).where(
                Review.order_id == body.order_id,
                Review.product_id == body.product_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Review already exists for this order/product")

    review_body = body.body or ""
    for pattern in BLOCK_PATTERNS:
        if pattern.search(review_body):
            raise HTTPException(status_code=400, detail="Review body contains prohibited content (email or phone number)")

    review = Review(
        order_id=body.order_id,
        product_id=body.product_id,
        seller_id=product.seller_id,
        buyer_id=user.id,
        rating=body.rating,
        title=body.title,
        body=body.body,
        product_accuracy=body.product_accuracy,
        packaging_quality=body.packaging_quality,
        dispatch_speed=body.dispatch_speed,
        communication=body.communication,
    )
    db.add(review)

    seller_profile = (
        await db.execute(
            select(SellerProfile).where(SellerProfile.user_id == product.seller_id)
        )
    ).scalar_one_or_none()
    if seller_profile:
        old_count = seller_profile.review_count or 0
        old_rating = float(seller_profile.total_rating or 0)
        new_count = old_count + 1
        new_rating = ((old_rating * old_count) + body.rating) / new_count
        seller_profile.review_count = new_count
        seller_profile.total_rating = round(new_rating, 2)

    await db.commit()
    await db.refresh(review)
    return _to_response(review)


@router.get("/products/{product_id}/reviews", response_model=PaginatedReviews)
async def list_product_reviews(
    product_id: uuid.UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    conditions = [Review.product_id == product_id, Review.is_visible == True]

    total: int = (
        await db.execute(select(func.count(Review.id)).where(*conditions))
    ).scalar() or 0

    reviews = (
        await db.execute(
            select(Review)
            .where(*conditions)
            .order_by(Review.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    ).scalars().all()

    return PaginatedReviews(
        items=[_to_response(r) for r in reviews],
        total=total,
        page=page,
        pages=math.ceil(total / limit) if total else 0,
    )


@router.get("/sellers/{store_slug}/reviews", response_model=PaginatedReviews)
async def list_seller_reviews(
    store_slug: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    seller_profile = (
        await db.execute(
            select(SellerProfile).where(SellerProfile.store_slug == store_slug)
        )
    ).scalar_one_or_none()
    if seller_profile is None:
        raise HTTPException(status_code=404, detail="Seller not found")

    conditions = [Review.seller_id == seller_profile.user_id, Review.is_visible == True]

    total: int = (
        await db.execute(select(func.count(Review.id)).where(*conditions))
    ).scalar() or 0

    reviews = (
        await db.execute(
            select(Review)
            .where(*conditions)
            .order_by(Review.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    ).scalars().all()

    return PaginatedReviews(
        items=[_to_response(r) for r in reviews],
        total=total,
        page=page,
        pages=math.ceil(total / limit) if total else 0,
    )


@router.post("/reviews/{review_id}/helpful")
async def mark_helpful(
    review_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    review = (
        await db.execute(select(Review).where(Review.id == review_id))
    ).scalar_one_or_none()
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")

    review.helpful_count += 1
    await db.commit()
    await db.refresh(review)
    return {"helpful_count": review.helpful_count}
