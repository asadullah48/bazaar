import uuid
import pytest
from httpx import ASGITransport, AsyncClient

from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.catalog import Category, Product, ProductVariant
from app.models.user import User
from tests.conftest import _TestSession

BASE = "/v1/seller/inventory"


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def _make_seller_with_variant() -> tuple[str, uuid.UUID, uuid.UUID]:
    seller_id = uuid.uuid4()
    async with _TestSession() as db:
        db.add(User(id=seller_id, email=f"seller_{seller_id.hex[:6]}@test.dev",
                    password_hash=hash_password("Pass123!"), role="seller"))
        cat = Category(name="Test", slug=f"test-{seller_id.hex[:6]}")
        db.add(cat)
        await db.flush()
        product = Product(seller_id=seller_id, category_id=cat.id,
                          title="Test Product", slug=f"slug-{seller_id.hex[:6]}")
        db.add(product)
        await db.flush()
        variant = ProductVariant(product_id=product.id, price=100, stock_qty=20)
        db.add(variant)
        await db.commit()
        return create_access_token(str(seller_id), "seller"), seller_id, variant.id


@pytest.mark.anyio
async def test_list_inventory_returns_variants(client):
    token, _, variant_id = await _make_seller_with_variant()
    r = await client.get(BASE, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    ids = [row["variant_id"] for row in r.json()]
    assert str(variant_id) in ids


@pytest.mark.anyio
async def test_upsert_alert_creates_then_updates(client):
    token, _, variant_id = await _make_seller_with_variant()
    r = await client.put(f"{BASE}/{variant_id}/alert",
                         json={"threshold": 3, "auto_pause": True, "is_active": True},
                         headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["threshold"] == 3

    r2 = await client.put(f"{BASE}/{variant_id}/alert",
                          json={"threshold": 10, "auto_pause": False, "is_active": True},
                          headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    assert r2.json()["threshold"] == 10


@pytest.mark.anyio
async def test_adjust_stock_records_movement(client):
    token, _, variant_id = await _make_seller_with_variant()
    r = await client.post(f"{BASE}/{variant_id}/adjust",
                          json={"delta": -5, "reason": "correction", "note": "damaged"},
                          headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["qty_after"] == 15
    assert r.json()["delta"] == -5


@pytest.mark.anyio
async def test_adjust_stock_cannot_go_negative(client):
    token, _, variant_id = await _make_seller_with_variant()
    r = await client.post(f"{BASE}/{variant_id}/adjust",
                          json={"delta": -999, "reason": "correction"},
                          headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 400


@pytest.mark.anyio
async def test_auto_pause_on_zero_stock(client):
    token, _, variant_id = await _make_seller_with_variant()
    await client.put(f"{BASE}/{variant_id}/alert",
                     json={"threshold": 5, "auto_pause": True, "is_active": True},
                     headers={"Authorization": f"Bearer {token}"})
    r = await client.post(f"{BASE}/{variant_id}/adjust",
                          json={"delta": -20, "reason": "correction"},
                          headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    rows = (await client.get(BASE, headers={"Authorization": f"Bearer {token}"})).json()
    row = next(r for r in rows if r["variant_id"] == str(variant_id))
    assert row["is_active"] is False


@pytest.mark.anyio
async def test_export_returns_csv(client):
    token, _, _ = await _make_seller_with_variant()
    r = await client.get(f"{BASE}/export", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    assert "product_title" in r.text
