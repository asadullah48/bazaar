import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, update

from app.main import app
from app.models.catalog import Product
from app.models.user import SellerProfile, User
from tests.conftest import _TestSession

CATALOG = "/v1/products"
SELLERS = "/v1/sellers"
AUTH = "/v1/auth"
SELLER_PROD = "/v1/seller/products"


def _email(prefix="seller"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}@test.dev"


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def _register_login(client, role="seller"):
    email = _email(role)
    pw = "Pass123!"
    await client.post(f"{AUTH}/register", json={"email": email, "password": pw, "role": role})
    token = (await client.post(f"{AUTH}/login", json={"email": email, "password": pw})).json()["access_token"]
    return email, token


async def _publish(product_id: str):
    async with _TestSession() as db:
        await db.execute(update(Product).where(Product.id == uuid.UUID(product_id)).values(status="published"))
        await db.commit()


@pytest.fixture
async def seller_with_profile(client):
    email, token = await _register_login(client, "seller")
    me = (await client.get("/v1/users/me", headers={"Authorization": f"Bearer {token}"})).json()
    user_id = uuid.UUID(me["id"])
    slug = f"store-{uuid.uuid4().hex[:8]}"

    async with _TestSession() as db:
        db.add(SellerProfile(
            user_id=user_id,
            store_name="Test Store",
            store_slug=slug,
            status="approved",
        ))
        await db.commit()

    yield {"email": email, "token": token, "id": str(user_id), "slug": slug}

    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_empty_catalog(client):
    resp = await client.get(CATALOG)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert isinstance(data["items"], list)
    assert "total" in data and "page" in data and "pages" in data


async def test_catalog_shows_published(client, seller_with_profile):
    hdrs = {"Authorization": f"Bearer {seller_with_profile['token']}"}
    prod = (await client.post(SELLER_PROD, json={"title": "Published Widget", "condition": "new"}, headers=hdrs)).json()
    pid = prod["id"]
    await _publish(pid)

    resp = await client.get(CATALOG)
    assert resp.status_code == 200
    ids = [p["id"] for p in resp.json()["items"]]
    assert pid in ids


async def test_catalog_price_filter(client, seller_with_profile):
    hdrs = {"Authorization": f"Bearer {seller_with_profile['token']}"}
    prod = (await client.post(SELLER_PROD, json={"title": "Price Filter Test"}, headers=hdrs)).json()
    pid = prod["id"]

    await client.post(f"{SELLER_PROD}/{pid}/variants", json={"price": 500.0, "stock_qty": 5}, headers=hdrs)
    await _publish(pid)

    r_in = await client.get(CATALOG, params={"min_price": 400, "max_price": 600})
    assert any(p["id"] == pid for p in r_in.json()["items"])

    r_out = await client.get(CATALOG, params={"max_price": 200})
    assert not any(p["id"] == pid for p in r_out.json()["items"])


async def test_product_detail(client, seller_with_profile):
    hdrs = {"Authorization": f"Bearer {seller_with_profile['token']}"}
    prod = (await client.post(SELLER_PROD, json={"title": "Detail Test", "condition": "used"}, headers=hdrs)).json()
    pid = prod["id"]

    await client.post(f"{SELLER_PROD}/{pid}/variants", json={"price": 250.0, "stock_qty": 3}, headers=hdrs)
    await _publish(pid)

    resp = await client.get(f"{CATALOG}/{pid}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == pid
    assert data["condition"] == "used"
    assert len(data["variants"]) >= 1
    assert data["variants"][0]["price"] == 250.0


async def test_product_detail_404_unpublished(client, seller_with_profile):
    hdrs = {"Authorization": f"Bearer {seller_with_profile['token']}"}
    prod = (await client.post(SELLER_PROD, json={"title": "Draft Only"}, headers=hdrs)).json()
    resp = await client.get(f"{CATALOG}/{prod['id']}")
    assert resp.status_code == 404


async def test_seller_storefront(client, seller_with_profile):
    hdrs = {"Authorization": f"Bearer {seller_with_profile['token']}"}
    prod = (await client.post(SELLER_PROD, json={"title": "Storefront Product"}, headers=hdrs)).json()
    pid = prod["id"]
    await _publish(pid)

    resp = await client.get(f"{SELLERS}/{seller_with_profile['slug']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["store_name"] == "Test Store"
    assert any(p["id"] == pid for p in data["products"]["items"])
