import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.campaign import UserEvent

router = APIRouter(prefix="/v1/events", tags=["events"])


class UserEventCreate(BaseModel):
    session_id: str = Field(..., max_length=100)
    event_type: str = Field(..., pattern=r"^(view|click|add_to_cart|purchase)$")
    product_id: Optional[uuid.UUID] = None
    campaign_id: Optional[uuid.UUID] = None


@router.post("", status_code=204)
async def track_event(
    body: UserEventCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            claims = decode_token(auth_header[7:])
            sub = claims.get("sub")
            if sub:
                user_id = uuid.UUID(sub)
        except Exception:
            pass

    event = UserEvent(
        user_id=user_id,
        session_id=body.session_id,
        event_type=body.event_type,
        product_id=body.product_id,
        campaign_id=body.campaign_id,
    )
    db.add(event)
    background_tasks.add_task(db.commit)
