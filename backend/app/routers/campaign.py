import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.campaign import Campaign, CampaignProduct
from app.models.user import User
from app.schemas.campaign import CampaignCreate, CampaignOut, CampaignProductAdd, CampaignProductOut

router = APIRouter(prefix="/v1/campaigns", tags=["campaigns"])


@router.get("/", response_model=list[CampaignOut])
async def list_active_campaigns(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    result = await db.execute(
        select(Campaign)
        .where(Campaign.is_active == True)  # noqa: E712
        .where(Campaign.start_at <= now)
        .where(Campaign.end_at >= now)
        .order_by(Campaign.start_at.desc())
    )
    return result.scalars().all()


@router.get("/{slug}", response_model=CampaignOut)
async def get_campaign(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.post("/", response_model=CampaignOut, status_code=201)
async def create_campaign(
    body: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    existing = await db.execute(select(Campaign).where(Campaign.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slug already exists")
    campaign = Campaign(**body.model_dump())
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.patch("/{campaign_id}/activate", response_model=CampaignOut)
async def activate_campaign(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign.is_active = True
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.post("/{campaign_id}/products", response_model=CampaignProductOut, status_code=201)
async def add_product_to_campaign(
    campaign_id: uuid.UUID,
    body: CampaignProductAdd,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Campaign not found")
    cp = CampaignProduct(campaign_id=campaign_id, **body.model_dump())
    db.add(cp)
    await db.commit()
    await db.refresh(cp)
    return cp
