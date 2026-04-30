from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional
import uuid

from pydantic import BaseModel


# ── Product ──────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    title: str
    description: Optional[str] = None
    brand: Optional[str] = None
    condition: str = "new"
    category_id: Optional[uuid.UUID] = None
    tags: Optional[List[str]] = None
    attributes: Optional[Dict] = None
    is_b2b_eligible: bool = False
    b2b_moq: Optional[int] = None


class ProductUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    brand: Optional[str] = None
    condition: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    tags: Optional[List[str]] = None
    attributes: Optional[Dict] = None
    is_b2b_eligible: Optional[bool] = None
    b2b_moq: Optional[int] = None


class ProductResponse(BaseModel):
    id: uuid.UUID
    seller_id: uuid.UUID
    title: str
    slug: Optional[str] = None
    description: Optional[str] = None
    brand: Optional[str] = None
    condition: str
    category_id: Optional[uuid.UUID] = None
    tags: Optional[List[str]] = None
    attributes: Optional[Dict] = None
    is_b2b_eligible: bool
    b2b_moq: Optional[int] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ProductListItem(BaseModel):
    id: uuid.UUID
    title: str
    slug: Optional[str] = None
    status: str
    category_id: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Variant ───────────────────────────────────────────────────────────────────

class VariantCreate(BaseModel):
    option1_name: Optional[str] = None
    option1_value: Optional[str] = None
    option2_name: Optional[str] = None
    option2_value: Optional[str] = None
    option3_name: Optional[str] = None
    option3_value: Optional[str] = None
    price: float
    sale_price: Optional[float] = None
    cost_price: Optional[float] = None
    stock_qty: int = 0
    weight_grams: int = 500
    sku_code: Optional[str] = None


class VariantUpdate(BaseModel):
    option1_name: Optional[str] = None
    option1_value: Optional[str] = None
    option2_name: Optional[str] = None
    option2_value: Optional[str] = None
    option3_name: Optional[str] = None
    option3_value: Optional[str] = None
    price: Optional[float] = None
    sale_price: Optional[float] = None
    cost_price: Optional[float] = None
    stock_qty: Optional[int] = None
    weight_grams: Optional[int] = None
    sku_code: Optional[str] = None


class VariantResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    sku_code: Optional[str] = None
    option1_name: Optional[str] = None
    option1_value: Optional[str] = None
    option2_name: Optional[str] = None
    option2_value: Optional[str] = None
    option3_name: Optional[str] = None
    option3_value: Optional[str] = None
    price: float
    sale_price: Optional[float] = None
    cost_price: Optional[float] = None
    stock_qty: int
    weight_grams: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── B2B Pricing Tier ──────────────────────────────────────────────────────────

class B2BTierCreate(BaseModel):
    min_qty: int
    max_qty: Optional[int] = None
    price_per_unit: float
    sort_order: int = 0


class B2BTierResponse(BaseModel):
    id: uuid.UUID
    min_qty: int
    max_qty: Optional[int] = None
    price_per_unit: float
    sort_order: int

    model_config = {"from_attributes": True}


# ── Public Catalog ────────────────────────────────────────────────────────────

class CatalogListItem(BaseModel):
    id: uuid.UUID
    title: str
    slug: Optional[str] = None
    brand: Optional[str] = None
    condition: str
    category_id: Optional[uuid.UUID] = None
    seller_id: uuid.UUID
    min_price: Optional[float] = None
    is_b2b_eligible: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CatalogProductDetail(BaseModel):
    id: uuid.UUID
    seller_id: uuid.UUID
    title: str
    slug: Optional[str] = None
    description: Optional[str] = None
    brand: Optional[str] = None
    condition: str
    category_id: Optional[uuid.UUID] = None
    tags: Optional[List[str]] = None
    attributes: Optional[Dict] = None
    is_b2b_eligible: bool
    b2b_moq: Optional[int] = None
    status: str
    created_at: datetime
    variants: List[VariantResponse] = []
    b2b_tiers: List[B2BTierResponse] = []

    model_config = {"from_attributes": True}


class PaginatedCatalog(BaseModel):
    items: List[CatalogListItem]
    total: int
    page: int
    pages: int


class SellerStorefrontResponse(BaseModel):
    store_name: str
    description: Optional[str] = None
    city: Optional[str] = None
    total_rating: float
    review_count: int
    approved_at: Optional[datetime] = None
    products: PaginatedCatalog

    model_config = {"from_attributes": True}
