from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class CheckoutRequest(BaseModel):
    address: Dict[str, Any]
    payment_method: str  # cod|bank_transfer|jazzcash|easypaisa|card
    payment_terms: Optional[str] = None  # net15|net30 for B2B


class AdvanceOrderRequest(BaseModel):
    note: Optional[str] = None
    tracking_number: Optional[str] = None


class OrderLineItemResponse(BaseModel):
    variant_id: Optional[uuid.UUID] = None
    product_snapshot: Dict
    quantity: int
    unit_price: float
    line_total: float


class OrderResponse(BaseModel):
    id: uuid.UUID
    order_number: str
    seller_id: Optional[uuid.UUID] = None
    buyer_id: Optional[uuid.UUID] = None
    status: str
    tracking_number: Optional[str] = None
    payment_method: Optional[str] = None
    subtotal: float
    shipping_cost: float
    total_amount: float
    delivery_address: Dict
    created_at: datetime
    items: List[OrderLineItemResponse] = []


class CheckoutResponse(BaseModel):
    checkout_session_id: uuid.UUID
    orders: List[OrderResponse]
    total_orders: int


class PaginatedOrders(BaseModel):
    items: List[OrderResponse]
    total: int
    page: int
    pages: int
