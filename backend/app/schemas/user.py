from pydantic import BaseModel
from typing import Optional
import uuid


class UserMeResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    phone: Optional[str] = None
    phone_verified: bool

    model_config = {"from_attributes": True}


class UserMeUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
