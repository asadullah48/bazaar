from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.models.user import User, UserProfile
from app.schemas.user import UserMeResponse, UserMeUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserMeResponse)
async def get_me(user: User = Depends(get_current_active_user)):
    return user


@router.put("/me", response_model=UserMeResponse)
async def update_me(
    payload: UserMeUpdate,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.phone is not None:
        user.phone = payload.phone

    if payload.full_name is not None:
        result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
        profile = result.scalar_one_or_none()
        if profile is not None:
            profile.full_name = payload.full_name

    await db.commit()
    await db.refresh(user)
    return user
