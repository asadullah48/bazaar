from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel


class PayoutCalculateRequest(BaseModel):
    seller_id: Optional[uuid.UUID] = None
    period_start: date
    period_end: date


class MarkPaidRequest(BaseModel):
    bank_ref: str


class PayoutLineItemResponse(BaseModel):
    id: uuid.UUID
    order_id: Optional[uuid.UUID] = None
    order_total: float
    commission_rate: float
    commission_amount: float
    processing_fee: float
    seller_payout: float


class PayoutRecordResponse(BaseModel):
    id: uuid.UUID
    seller_id: uuid.UUID
    period_start: date
    period_end: date
    gross_amount: float
    commission_amount: float
    processing_fees: float
    net_amount: float
    status: str
    bank_ref: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: datetime
    line_items: List[PayoutLineItemResponse] = []


class PaginatedPayouts(BaseModel):
    items: List[PayoutRecordResponse]
    total: int
    page: int
    pages: int
