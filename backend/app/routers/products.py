import json
import re
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_seller
from app.models.catalog import Category, Product, ProductB2BTier, ProductVariant
from app.models.user import User
from app.schemas.product import (
    B2BTierCreate,
    B2BTierResponse,
    ProductCreate,
    ProductListItem,
    ProductResponse,
    ProductUpdate,
    VariantCreate,
    VariantResponse,
    VariantUpdate,
)

router = APIRouter(prefix="/seller", tags=["seller-products"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _slugify(title: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return f"{base}-{uuid.uuid4().hex[:8]}"


async def _own_product(product_id: uuid.UUID, seller: User, db: AsyncSession) -> Product:
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.seller_id != seller.id:
        raise HTTPException(status_code=403, detail="Not the product owner")
    return product


async def _own_variant(
    variant_id: uuid.UUID, product: Product, db: AsyncSession
) -> ProductVariant:
    result = await db.execute(
        select(ProductVariant).where(
            ProductVariant.id == variant_id,
            ProductVariant.product_id == product.id,
        )
    )
    variant = result.scalar_one_or_none()
    if variant is None:
        raise HTTPException(status_code=404, detail="Variant not found")
    return variant


# ── Product CRUD ──────────────────────────────────────────────────────────────

@router.post("/products", response_model=ProductResponse, status_code=201)
async def create_product(
    payload: ProductCreate,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    product = Product(
        seller_id=seller.id,
        title=payload.title,
        slug=_slugify(payload.title),
        description=payload.description,
        brand=payload.brand,
        condition=payload.condition,
        category_id=payload.category_id,
        tags=payload.tags,
        attributes=payload.attributes,
        is_b2b_eligible=payload.is_b2b_eligible,
        b2b_moq=payload.b2b_moq,
        status="draft",
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.get("/products", response_model=List[ProductListItem])
async def list_products(
    status: Optional[str] = Query(None),
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    q = select(Product).where(Product.seller_id == seller.id)
    if status:
        q = q.where(Product.status == status)
    result = await db.execute(q.order_by(Product.created_at.desc()))
    return result.scalars().all()


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: uuid.UUID,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    return await _own_product(product_id, seller, db)


@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    product = await _own_product(product_id, seller, db)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(product, field, value)
    await db.commit()
    await db.refresh(product)
    return product


@router.put("/products/{product_id}/publish", response_model=ProductResponse)
async def publish_product(
    product_id: uuid.UUID,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    product = await _own_product(product_id, seller, db)
    product.status = "under_review"
    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/products/{product_id}", response_model=ProductResponse)
async def archive_product(
    product_id: uuid.UUID,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    product = await _own_product(product_id, seller, db)
    product.status = "archived"
    await db.commit()
    await db.refresh(product)
    return product


# ── Variants ──────────────────────────────────────────────────────────────────

@router.post("/products/{product_id}/variants", response_model=VariantResponse, status_code=201)
async def add_variant(
    product_id: uuid.UUID,
    payload: VariantCreate,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    product = await _own_product(product_id, seller, db)
    sku = payload.sku_code or f"SKU-{uuid.uuid4().hex[:10].upper()}"
    variant = ProductVariant(
        product_id=product.id,
        sku_code=sku,
        option1_name=payload.option1_name,
        option1_value=payload.option1_value,
        option2_name=payload.option2_name,
        option2_value=payload.option2_value,
        option3_name=payload.option3_name,
        option3_value=payload.option3_value,
        price=payload.price,
        sale_price=payload.sale_price,
        cost_price=payload.cost_price,
        stock_qty=payload.stock_qty,
        weight_grams=payload.weight_grams,
    )
    db.add(variant)
    await db.commit()
    await db.refresh(variant)
    return variant


@router.get("/products/{product_id}/variants", response_model=List[VariantResponse])
async def list_variants(
    product_id: uuid.UUID,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    product = await _own_product(product_id, seller, db)
    result = await db.execute(
        select(ProductVariant).where(
            ProductVariant.product_id == product.id,
            ProductVariant.is_active == True,
        )
    )
    return result.scalars().all()


@router.put(
    "/products/{product_id}/variants/{variant_id}", response_model=VariantResponse
)
async def update_variant(
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
    payload: VariantUpdate,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    product = await _own_product(product_id, seller, db)
    variant = await _own_variant(variant_id, product, db)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(variant, field, value)
    await db.commit()
    await db.refresh(variant)
    return variant


@router.delete("/products/{product_id}/variants/{variant_id}", response_model=VariantResponse)
async def deactivate_variant(
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    product = await _own_product(product_id, seller, db)
    variant = await _own_variant(variant_id, product, db)
    variant.is_active = False
    await db.commit()
    await db.refresh(variant)
    return variant


# ── B2B Pricing Tiers ─────────────────────────────────────────────────────────

@router.post("/products/{product_id}/tiers", response_model=B2BTierResponse, status_code=201)
async def add_tier(
    product_id: uuid.UUID,
    payload: B2BTierCreate,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    product = await _own_product(product_id, seller, db)
    tier = ProductB2BTier(
        product_id=product.id,
        min_qty=payload.min_qty,
        max_qty=payload.max_qty,
        price_per_unit=payload.price_per_unit,
        sort_order=payload.sort_order,
    )
    db.add(tier)
    await db.commit()
    await db.refresh(tier)
    return tier


@router.get("/products/{product_id}/tiers", response_model=List[B2BTierResponse])
async def list_tiers(
    product_id: uuid.UUID,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    product = await _own_product(product_id, seller, db)
    result = await db.execute(
        select(ProductB2BTier)
        .where(ProductB2BTier.product_id == product.id)
        .order_by(ProductB2BTier.sort_order)
    )
    return result.scalars().all()


@router.delete("/products/{product_id}/tiers/{tier_id}", status_code=204)
async def delete_tier(
    product_id: uuid.UUID,
    tier_id: uuid.UUID,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    product = await _own_product(product_id, seller, db)
    result = await db.execute(
        select(ProductB2BTier).where(
            ProductB2BTier.id == tier_id,
            ProductB2BTier.product_id == product.id,
        )
    )
    tier = result.scalar_one_or_none()
    if tier is None:
        raise HTTPException(status_code=404, detail="Tier not found")
    await db.delete(tier)
    await db.commit()


# ── SEO + QR ──────────────────────────────────────────────────────────────────

@router.post("/products/{product_id}/seo")
async def trigger_seo(
    product_id: uuid.UUID,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    from app.services.seo_generator import generate_product_seo
    product = await _own_product(product_id, seller, db)
    try:
        seo_data = await generate_product_seo(product)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    product.seo_data = seo_data
    await db.commit()
    return seo_data


@router.post("/products/{product_id}/qr")
async def trigger_qr(
    product_id: uuid.UUID,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    from app.core.arq import get_arq_pool
    await _own_product(product_id, seller, db)
    pool = await get_arq_pool()
    job = await pool.enqueue_job("generate_product_qr", str(product_id))
    return {"status": "queued", "job_id": job.job_id}


# ── AI listing tools (Phase 4C) ───────────────────────────────────────────────

class AiDescribeRequest(BaseModel):
    title: str
    description: Optional[str] = None


class AiCategorizeRequest(BaseModel):
    title: str


@router.post("/ai-describe")
async def ai_describe(
    payload: AiDescribeRequest,
    seller: User = Depends(require_seller),
):
    from anthropic import AsyncAnthropic
    from app.core.config import get_settings
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise HTTPException(503, "AI service not configured")

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    prompt = (
        f"Rewrite this product description to be SEO-optimized and compelling for Pakistani buyers. "
        f"Return ONLY the improved description text — no commentary, no markdown, no intro sentence.\n\n"
        f"Product: {payload.title}\n"
        f"Current description: {payload.description or 'None provided'}"
    )
    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )
    return {"description": message.content[0].text.strip()}


@router.post("/ai-categorize")
async def ai_categorize(
    payload: AiCategorizeRequest,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    from anthropic import AsyncAnthropic
    from app.core.config import get_settings
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise HTTPException(503, "AI service not configured")

    result = await db.execute(select(Category.id, Category.name).where(Category.parent_id == None))  # noqa: E711
    top_cats = result.all()
    if not top_cats:
        raise HTTPException(404, "No categories configured")

    cats_text = ", ".join(r.name for r in top_cats)
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    prompt = (
        f"Product title: {payload.title}\n"
        f"Available categories: {cats_text}\n\n"
        f"Return JSON only: {{\"category_name\": \"best match\", \"confidence\": 0.95}}"
    )
    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=100,
        messages=[{"role": "user", "content": prompt}],
    )
    data = json.loads(message.content[0].text.strip())

    # Find the matching category ID
    cat_name = data.get("category_name", "")
    matched_id = None
    for r in top_cats:
        if r.name.lower() == cat_name.lower():
            matched_id = str(r.id)
            break

    return {
        "category_name": cat_name,
        "category_id": matched_id,
        "confidence": data.get("confidence", 0.0),
    }
