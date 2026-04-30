import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, update

from app.main import app
from app.models.catalog import Product
from app.models.user import SellerProfile, User
from tests.conftest import _TestSession

WISHLIST = "/v1/wishlist"
AUTH = "/v1/auth"
SELLER_PROD = "/v1/seller/products"


def _email(prefix="wl"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}@test.dev"


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def _register_login(client, role="consumer"):
    email = _email(role)
    pw = "Pass123!"
    await client.post(f"{AUTH}/register", json={"email": email, "password": pw, "role": role})
    token = (await client.post(f"{AUTH}/login", json={"email": email, "password": pw})).json()["access_token"]
    return email, token


@pytest.fixture
async def buyer(client):
    email, token = await _register_login(client, "consumer")
    yield {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}
    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


@pytest.fixture
async def published_product(client):
    email, token = await _register_login(client, "seller")
    hdrs = {"Authorization": f"Bearer {token}"}
    me = (await client.get("/v1/users/me", headers=hdrs)).json()
    user_id = uuid.UUID(me["id"])
    slug = f"wl-store-{uuid.uuid4().hex[:8]}"

    async with _TestSession() as db:
        db.add(SellerProfile(
            user_id=user_id,
            store_name="Wishlist Test Store",
            store_slug=slug,
            status="approved",
        ))
        await db.commit()

    prod = (await client.post(
        SELLER_PROD,
        json={"title": "Wishlist Test Product"},
        headers=hdrs,
    )).json()
    pid = prod["id"]

    async with _TestSession() as db:
        await db.execute(update(Product).where(Product.id == uuid.UUID(pid)).values(status="published"))
        await db.commit()

    yield {"product_id": pid, "seller_email": email}

    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_add_and_list_wishlist(client, buyer, published_product):
    hdrs = buyer["headers"]
    pid = published_product["product_id"]

    r = await client.post(f"{WISHLIST}/{pid}", headers=hdrs)
    assert r.status_code == 201, r.text
    assert r.json()["product_id"] == pid

    r = await client.get(WISHLIST, headers=hdrs)
    assert r.status_code == 200
    assert any(item["product_id"] == pid for item in r.json())


async def test_duplicate_wishlist_409(client, buyer, published_product):
    hdrs = buyer["headers"]
    pid = published_product["product_id"]

    await client.post(f"{WISHLIST}/{pid}", headers=hdrs)
    r = await client.post(f"{WISHLIST}/{pid}", headers=hdrs)
    assert r.status_code == 409, r.text


async def test_remove_from_wishlist(client, buyer, published_product):
    hdrs = buyer["headers"]
    pid = published_product["product_id"]

    await client.post(f"{WISHLIST}/{pid}", headers=hdrs)

    r = await client.delete(f"{WISHLIST}/{pid}", headers=hdrs)
    assert r.status_code == 204

    r = await client.get(WISHLIST, headers=hdrs)
    assert r.status_code == 200
    assert not any(item["product_id"] == pid for item in r.json())
