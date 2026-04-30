from __future__ import annotations

from datetime import datetime
from typing import Optional
import uuid

from pydantic import BaseModel


class AdminProductListItem(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    seller_id: uuid.UUID
    seller_store_name: Optional[str] = None
    seller_email: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminProductDetail(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    rejection_reason: Optional[str] = None
    seller_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminSellerItem(BaseModel):
    id: uuid.UUID
    store_name: str
    email: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminPaginatedProducts(BaseModel):
    items: list[AdminProductListItem]
    total: int
    page: int
    pages: int


class AdminPaginatedSellers(BaseModel):
    items: list[AdminSellerItem]
    total: int
    page: int
    pages: int


class RejectPayload(BaseModel):
    reason: str
