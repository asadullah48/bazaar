import uuid
from pydantic import BaseModel, Field
from datetime import datetime


class AlertUpsert(BaseModel):
    threshold: int = Field(ge=0)
    auto_pause: bool = True
    is_active: bool = True


class AlertResponse(BaseModel):
    id: uuid.UUID
    variant_id: uuid.UUID
    threshold: int
    auto_pause: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class StockAdjust(BaseModel):
    delta: int  # positive = restock, negative = correction
    reason: str = Field(pattern="^(restock|adjustment|correction)$")
    note: str | None = None


class StockMovementResponse(BaseModel):
    id: uuid.UUID
    variant_id: uuid.UUID
    delta: int
    reason: str
    note: str | None
    qty_after: int
    created_at: datetime

    model_config = {"from_attributes": True}


class VariantInventoryRow(BaseModel):
    variant_id: uuid.UUID
    product_title: str
    sku_code: str | None
    option1_name: str | None
    option1_value: str | None
    stock_qty: int
    threshold: int | None
    auto_pause: bool | None
    is_active: bool

    model_config = {"from_attributes": True}
