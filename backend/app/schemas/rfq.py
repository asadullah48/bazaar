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
