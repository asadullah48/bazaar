import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CampaignCreate(BaseModel):
    title: str = Field(..., max_length=200)
    slug: str = Field(..., max_length=200, pattern=r"^[a-z0-9-]+$")
    type: str = Field(..., pattern=r"^(flash_sale|editorial|brand_promo)$")
    start_at: datetime
    end_at: datetime
    banner_url: Optional[str] = Field(None, max_length=500)
    discount_pct: Optional[float] = Field(None, ge=0, le=100)


class CampaignOut(BaseModel):
    id: uuid.UUID
    title: str
    slug: str
    type: str
    start_at: datetime
    end_at: datetime
    is_active: bool
    banner_url: Optional[str]
    discount_pct: Optional[float]
    created_at: datetime

    model_config = {"from_attributes": True}


class CampaignProductAdd(BaseModel):
    product_id: uuid.UUID
    position: int = 0
    override_price: Optional[float] = None


class CampaignProductOut(BaseModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    product_id: uuid.UUID
    position: int
    override_price: Optional[float]

    model_config = {"from_attributes": True}
