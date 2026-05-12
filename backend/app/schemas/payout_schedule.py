import uuid
from pydantic import BaseModel, Field
from datetime import datetime


class ScheduleUpsert(BaseModel):
    frequency: str = Field(pattern="^(weekly|biweekly)$")
    bank_name: str | None = None
    account_number: str | None = None
    account_title: str | None = None


class ScheduleResponse(BaseModel):
    id: uuid.UUID
    seller_id: uuid.UUID
    frequency: str
    bank_name: str | None
    account_number: str | None
    account_title: str | None
    is_active: bool
    updated_at: datetime

    model_config = {"from_attributes": True}
