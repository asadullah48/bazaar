import csv
import io
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_seller
from app.models.catalog import InventoryAlert, ProductVariant, Product, StockMovement
from app.models.user import User
from app.schemas.inventory import (
    AlertUpsert, AlertResponse, StockAdjust, StockMovementResponse, VariantInventoryRow
)

router = APIRouter(prefix="/seller/inventory", tags=["seller-inventory"])


async def _seller_variant(variant_id: uuid.UUID, seller: User, db: AsyncSession) -> ProductVariant:
    result = await db.execute(
        select(ProductVariant)
        .join(Product, ProductVariant.product_id == Product.id)
        .where(ProductVariant.id == variant_id, Product.seller_id == seller.id)
    )
    v = result.scalar_one_or_none()
    if v is None:
        raise HTTPException(404, "Variant not found or not owned by seller")
    return v


@router.get("", response_model=list[VariantInventoryRow])
async def list_inventory(
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(ProductVariant, Product.title, InventoryAlert)
        .join(Product, ProductVariant.product_id == Product.id)
        .outerjoin(InventoryAlert, InventoryAlert.variant_id == ProductVariant.id)
        .where(Product.seller_id == seller.id)
        .order_by(Product.title, ProductVariant.option1_value)
    )
    result = []
    for variant, title, alert in rows:
        result.append(VariantInventoryRow(
            variant_id=variant.id,
            product_title=title,
            sku_code=variant.sku_code,
            option1_name=variant.option1_name,
            option1_value=variant.option1_value,
            stock_qty=variant.stock_qty,
            threshold=alert.threshold if alert else None,
            auto_pause=alert.auto_pause if alert else None,
            is_active=variant.is_active,
        ))
    return result


@router.get("/export")
async def export_inventory(
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(ProductVariant, Product.title, InventoryAlert)
        .join(Product, ProductVariant.product_id == Product.id)
        .outerjoin(InventoryAlert, InventoryAlert.variant_id == ProductVariant.id)
        .where(Product.seller_id == seller.id)
        .order_by(Product.title)
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["product_title", "sku_code", "option1_name", "option1_value",
                     "stock_qty", "alert_threshold", "auto_pause", "is_active"])
    for variant, title, alert in rows:
        writer.writerow([
            title,
            variant.sku_code or "",
            variant.option1_name or "",
            variant.option1_value or "",
            variant.stock_qty,
            alert.threshold if alert else "",
            alert.auto_pause if alert else "",
            variant.is_active,
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=inventory.csv"},
    )


@router.put("/{variant_id}/alert", response_model=AlertResponse)
async def upsert_alert(
    variant_id: uuid.UUID,
    body: AlertUpsert,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    await _seller_variant(variant_id, seller, db)
    result = await db.execute(select(InventoryAlert).where(InventoryAlert.variant_id == variant_id))
    alert = result.scalar_one_or_none()
    if alert is None:
        alert = InventoryAlert(variant_id=variant_id, **body.model_dump())
        db.add(alert)
    else:
        for k, v in body.model_dump().items():
            setattr(alert, k, v)
    await db.commit()
    await db.refresh(alert)
    return alert


@router.post("/{variant_id}/adjust", response_model=StockMovementResponse)
async def adjust_stock(
    variant_id: uuid.UUID,
    body: StockAdjust,
    seller: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
):
    variant = await _seller_variant(variant_id, seller, db)
    new_qty = variant.stock_qty + body.delta
    if new_qty < 0:
        raise HTTPException(400, "Stock cannot go below 0")
    variant.stock_qty = new_qty

    result = await db.execute(select(InventoryAlert).where(InventoryAlert.variant_id == variant_id))
    alert = result.scalar_one_or_none()
    if alert and alert.auto_pause and new_qty == 0:
        variant.is_active = False

    movement = StockMovement(
        variant_id=variant_id,
        changed_by=seller.id,
        delta=body.delta,
        reason=body.reason,
        note=body.note,
        qty_after=new_qty,
    )
    db.add(movement)
    await db.commit()
    await db.refresh(movement)
    return movement
