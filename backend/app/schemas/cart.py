from __future__ import annotations

import uuid
from typing import List, Optional

from pydantic import BaseModel, Field


class CartItemAdd(BaseModel):
    variant_id: uuid.UUID
    quantity: int = Field(1, ge=1)
    is_b2b: bool = False


class CartItemUpdate(BaseModel):
    quantity: int = Field(..., ge=1)


class CartItemResponse(BaseModel):
    id: uuid.UUID
    variant_id: uuid.UUID
    product_id: uuid.UUID
    title: str
    image_url: Optional[str] = None
    option1_name: Optional[str] = None
    option1_value: Optional[str] = None
    option2_name: Optional[str] = None
    option2_value: Optional[str] = None
    price: float
    quantity: int
    is_b2b: bool
    line_total: float


class CartResponse(BaseModel):
    items: List[CartItemResponse]
    subtotal: float
    item_count: int
