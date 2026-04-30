import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, update

from app.main import app
from app.models.catalog import Product
from app.models.user import SellerProfile, User
from tests.conftest import _TestSession

SEARCH = "/v1/search"
AUTH = "/v1/auth"
SELLER_PROD = "/v1/seller/products"


def _email(prefix="srch"):
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
async def seller(client):
    email, token = await _register_login(client, "seller")
    me = (await client.get("/v1/users/me", headers={"Authorization": f"Bearer {token}"})).json()
    user_id = uuid.UUID(me["id"])
    slug = f"srch-store-{uuid.uuid4().hex[:8]}"

    async with _TestSession() as db:
        db.add(SellerProfile(
            user_id=user_id,
            store_name="Search Test Store",
            store_slug=slug,
            status="approved",
        ))
        await db.commit()

    yield {"email": email, "token": token, "id": user_id,
           "headers": {"Authorization": f"Bearer {token}"}}

    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_search_no_results(client):
    r = await client.get(SEARCH, params={"q": f"zzznomatch_{uuid.uuid4().hex}"})
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 0
    assert data["items"] == []


async def test_search_finds_published_product(client, seller):
    hdrs = seller["headers"]
    prod = (await client.post(
        SELLER_PROD,
        json={"title": "Sony Wireless Headphones", "brand": "Sony"},
        headers=hdrs,
    )).json()
    pid = prod["id"]
    await client.post(f"{SELLER_PROD}/{pid}/variants", json={"price": 3500.0, "stock_qty": 10}, headers=hdrs)
    await _publish(pid)

    r = await client.get(SEARCH, params={"q": "sony"})
    assert r.status_code == 200, r.text
    ids = [p["id"] for p in r.json()["items"]]
    assert pid in ids


async def test_search_price_filter_excludes_product(client, seller):
    hdrs = seller["headers"]
    prod = (await client.post(
        SELLER_PROD,
        json={"title": "Sony Wireless Headphones Price Test"},
        headers=hdrs,
    )).json()
    pid = prod["id"]
    await client.post(f"{SELLER_PROD}/{pid}/variants", json={"price": 3500.0, "stock_qty": 5}, headers=hdrs)
    await _publish(pid)

    r = await client.get(SEARCH, params={"q": "Sony Wireless Headphones Price Test", "min_price": 9000})
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()["items"]]
    assert pid not in ids


async def test_search_suggestions(client, seller):
    hdrs = seller["headers"]
    prod = (await client.post(
        SELLER_PROD,
        json={"title": "Sony Premium Earbuds"},
        headers=hdrs,
    )).json()
    pid = prod["id"]
    await _publish(pid)

    r = await client.get(f"{SEARCH}/suggestions", params={"q": "son"})
    assert r.status_code == 200, r.text
    suggestions = r.json()["suggestions"]
    assert any("Sony" in s for s in suggestions)


async def test_search_empty_query_returns_400(client):
    r = await client.get(SEARCH, params={"q": "   "})
    assert r.status_code == 400
