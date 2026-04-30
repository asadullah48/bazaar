import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.models.user import Address, User
from app.schemas.address import AddressCreate, AddressResponse, AddressUpdate

router = APIRouter(tags=["addresses"])


def _to_response(addr: Address) -> AddressResponse:
    return AddressResponse(
        id=addr.id,
        user_id=addr.user_id,
        full_name=addr.full_name,
        phone=addr.phone,
        address_line1=addr.address_line1,
        address_line2=addr.address_line2,
        city=addr.city,
        province=addr.province,
        postal_code=addr.postal_code,
        label=addr.label,
        is_default=addr.is_default,
        created_at=addr.created_at,
    )


@router.get("/users/me/addresses", response_model=List[AddressResponse])
async def list_addresses(
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(select(Address).where(Address.user_id == user.id))
    ).scalars().all()
    return [_to_response(a) for a in rows]


@router.post("/users/me/addresses", response_model=AddressResponse, status_code=201)
async def create_address(
    body: AddressCreate,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if body.is_default:
        await db.execute(
            update(Address).where(Address.user_id == user.id).values(is_default=False)
        )

    addr = Address(
        user_id=user.id,
        full_name=body.full_name,
        phone=body.phone,
        address_line1=body.address_line1,
        address_line2=body.address_line2,
        city=body.city,
        province=body.province,
        postal_code=body.postal_code,
        label=body.label,
        is_default=body.is_default,
    )
    db.add(addr)
    await db.commit()
    await db.refresh(addr)
    return _to_response(addr)


@router.put("/users/me/addresses/{address_id}", response_model=AddressResponse)
async def update_address(
    address_id: uuid.UUID,
    body: AddressUpdate,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    addr = (
        await db.execute(
            select(Address).where(Address.id == address_id, Address.user_id == user.id)
        )
    ).scalar_one_or_none()
    if addr is None:
        raise HTTPException(status_code=404, detail="Address not found")

    if body.is_default:
        await db.execute(
            update(Address).where(Address.user_id == user.id).values(is_default=False)
        )

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(addr, field, value)

    await db.commit()
    await db.refresh(addr)
    return _to_response(addr)


@router.delete("/users/me/addresses/{address_id}", status_code=204)
async def delete_address(
    address_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    addr = (
        await db.execute(
            select(Address).where(Address.id == address_id, Address.user_id == user.id)
        )
    ).scalar_one_or_none()
    if addr is None:
        raise HTTPException(status_code=404, detail="Address not found")

    await db.delete(addr)
    await db.commit()
