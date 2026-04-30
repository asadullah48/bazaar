import re
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.catalog import Category
from app.models.user import User
from app.schemas.category import (
    CategoryCreate,
    CategoryDetail,
    CategoryNode,
    CategoryUpdate,
)

router = APIRouter(tags=["categories"])


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _build_tree(categories: list) -> List[CategoryNode]:
    by_parent: dict = {}
    for cat in categories:
        key = str(cat.parent_id) if cat.parent_id else None
        by_parent.setdefault(key, []).append(cat)

    def build(parent_id):
        return [
            CategoryNode(
                id=cat.id,
                name=cat.name,
                slug=cat.slug,
                icon_url=cat.icon_url,
                children=build(str(cat.id)),
            )
            for cat in by_parent.get(parent_id, [])
        ]

    return build(None)


@router.get("/categories", response_model=List[CategoryNode])
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Category).where(Category.is_active == True).order_by(Category.sort_order)
    )
    cats = result.scalars().all()
    return _build_tree(cats)


@router.get("/categories/{slug}", response_model=CategoryDetail)
async def get_category(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Category).where(Category.slug == slug, Category.is_active == True)
    )
    cat = result.scalar_one_or_none()
    if cat is None:
        raise HTTPException(status_code=404, detail="Category not found")

    children_result = await db.execute(
        select(Category).where(Category.parent_id == cat.id, Category.is_active == True)
    )
    children = children_result.scalars().all()

    return CategoryDetail(
        id=cat.id,
        name=cat.name,
        slug=cat.slug,
        icon_url=cat.icon_url,
        banner_url=cat.banner_url,
        description=cat.description,
        commission_rate=float(cat.commission_rate),
        children=[
            CategoryNode(id=c.id, name=c.name, slug=c.slug, icon_url=c.icon_url)
            for c in children
        ],
    )


@router.post("/admin/categories", status_code=201)
async def create_category(
    payload: CategoryCreate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    slug = payload.slug or _slugify(payload.name)
    cat = Category(
        id=uuid.uuid4(),
        name=payload.name,
        slug=slug,
        parent_id=payload.parent_id,
        commission_rate=payload.commission_rate,
        icon_url=payload.icon_url,
    )
    db.add(cat)
    await db.commit()
    return {"id": str(cat.id), "name": cat.name, "slug": cat.slug}


@router.put("/admin/categories/{cat_id}", status_code=200)
async def update_category(
    cat_id: uuid.UUID,
    payload: CategoryUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Category).where(Category.id == cat_id))
    cat = result.scalar_one_or_none()
    if cat is None:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(cat, field, value)
    await db.commit()
    return {"id": str(cat.id), "name": cat.name, "slug": cat.slug}


@router.delete("/admin/categories/{cat_id}", status_code=204)
async def delete_category(
    cat_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Category).where(Category.id == cat_id))
    cat = result.scalar_one_or_none()
    if cat is None:
        raise HTTPException(status_code=404, detail="Category not found")
    cat.is_active = False
    await db.commit()
