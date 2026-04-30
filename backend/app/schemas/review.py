from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class ReviewCreate(BaseModel):
    order_id: uuid.UUID
    product_id: uuid.UUID
    rating: int
    title: Optional[str] = None
    body: str
    product_accuracy: Optional[int] = None
    packaging_quality: Optional[int] = None
    dispatch_speed: Optional[int] = None
    communication: Optional[int] = None

    @field_validator("rating", "product_accuracy", "packaging_quality", "dispatch_speed", "communication", mode="before")
    @classmethod
    def validate_rating_range(cls, v):
        if v is not None and not (1 <= v <= 5):
            raise ValueError("Rating must be between 1 and 5")
        return v

    @field_validator("body")
    @classmethod
    def validate_body_length(cls, v):
        if len(v) < 20:
            raise ValueError("Review body must be at least 20 characters")
        return v


class ReviewResponse(BaseModel):
    id: uuid.UUID
    order_id: Optional[uuid.UUID] = None
    product_id: Optional[uuid.UUID] = None
    seller_id: Optional[uuid.UUID] = None
    buyer_id: Optional[uuid.UUID] = None
    rating: int
    title: Optional[str] = None
    body: Optional[str] = None
    product_accuracy: Optional[int] = None
    packaging_quality: Optional[int] = None
    dispatch_speed: Optional[int] = None
    communication: Optional[int] = None
    helpful_count: int
    created_at: datetime


class PaginatedReviews(BaseModel):
    items: list[ReviewResponse]
    total: int
    page: int
    pages: int
