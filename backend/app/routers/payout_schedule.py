from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_seller
from app.models.payout import SellerPayoutSchedule
from app.models.user import User
from app.schemas.payout_schedule import ScheduleUpsert, ScheduleResponse

router = APIRouter(prefix="/seller/payout-schedule", tags=["seller-payouts"])


@router.get("", response_model=ScheduleResponse | None)
async def get_schedule(
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SellerPayoutSchedule).where(SellerPayoutSchedule.seller_id == seller.id)
    )
    return result.scalar_one_or_none()


@router.put("", response_model=ScheduleResponse)
async def upsert_schedule(
    body: ScheduleUpsert,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SellerPayoutSchedule).where(SellerPayoutSchedule.seller_id == seller.id)
    )
    schedule = result.scalar_one_or_none()
    if schedule is None:
        schedule = SellerPayoutSchedule(seller_id=seller.id, **body.model_dump())
        db.add(schedule)
    else:
        for k, v in body.model_dump().items():
            setattr(schedule, k, v)
    await db.commit()
    await db.refresh(schedule)
    return schedule
