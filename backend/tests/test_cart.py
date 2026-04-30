import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, update

from app.main import app
from app.models.catalog import Product
from app.models.user import User
from tests.conftest import _TestSession

CART = "/v1/cart"
AUTH = "/v1/auth"
SELLER_PROD = "/v1/seller/products"


def _email(prefix="user"):
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
async def seller_product(client):
    """Seller with 1 published product + 1 active variant (stock=5, price=100)."""
    email, token = await _register_login(client, "seller")
    hdrs = {"Authorization": f"Bearer {token}"}

    prod = (await client.post(
        SELLER_PROD, json={"title": "Cart Widget", "condition": "new"}, headers=hdrs
    )).json()
    pid = prod["id"]

    var = (await client.post(
        f"{SELLER_PROD}/{pid}/variants",
        json={"price": 100.0, "stock_qty": 5},
        headers=hdrs,
    )).json()
    vid = var["id"]

    async with _TestSession() as db:
        await db.execute(
            update(Product).where(Product.id == uuid.UUID(pid)).values(status="published")
        )
        await db.commit()

    yield {"email": email, "token": token, "headers": hdrs, "product_id": pid, "variant_id": vid}

    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_add_item_and_get_cart(client, buyer, seller_product):
    vid = seller_product["variant_id"]

    add_resp = await client.post(
        f"{CART}/items",
        json={"variant_id": vid, "quantity": 2},
        headers=buyer["headers"],
    )
    assert add_resp.status_code == 200, add_resp.text
    cart = add_resp.json()
    assert cart["item_count"] == 2
    assert cart["subtotal"] == 200.0
    assert len(cart["items"]) == 1
    assert cart["items"][0]["line_total"] == 200.0

    get_resp = await client.get(CART, headers=buyer["headers"])
    assert get_resp.status_code == 200
    assert get_resp.json()["item_count"] == 2


async def test_add_same_item_increments_quantity(client, buyer, seller_product):
    vid = seller_product["variant_id"]
    hdrs = buyer["headers"]

    await client.post(f"{CART}/items", json={"variant_id": vid, "quantity": 1}, headers=hdrs)
    await client.post(f"{CART}/items", json={"variant_id": vid, "quantity": 2}, headers=hdrs)

    cart = (await client.get(CART, headers=hdrs)).json()
    assert len(cart["items"]) == 1
    assert cart["items"][0]["quantity"] == 3


async def test_update_quantity(client, buyer, seller_product):
    vid = seller_product["variant_id"]
    hdrs = buyer["headers"]

    add_resp = await client.post(
        f"{CART}/items", json={"variant_id": vid, "quantity": 1}, headers=hdrs
    )
    item_id = add_resp.json()["items"][0]["id"]

    upd_resp = await client.put(f"{CART}/items/{item_id}", json={"quantity": 4}, headers=hdrs)
    assert upd_resp.status_code == 200
    assert upd_resp.json()["items"][0]["quantity"] == 4


async def test_remove_item(client, buyer, seller_product):
    vid = seller_product["variant_id"]
    hdrs = buyer["headers"]

    add_resp = await client.post(
        f"{CART}/items", json={"variant_id": vid, "quantity": 1}, headers=hdrs
    )
    item_id = add_resp.json()["items"][0]["id"]

    del_resp = await client.delete(f"{CART}/items/{item_id}", headers=hdrs)
    assert del_resp.status_code == 200
    assert del_resp.json()["item_count"] == 0


async def test_add_qty_exceeds_stock(client, buyer, seller_product):
    vid = seller_product["variant_id"]  # stock_qty = 5

    resp = await client.post(
        f"{CART}/items",
        json={"variant_id": vid, "quantity": 10},
        headers=buyer["headers"],
    )
    assert resp.status_code == 400
