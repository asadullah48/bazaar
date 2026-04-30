import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select, update

from app.main import app
from app.models.catalog import Product, ProductVariant
from app.models.order import CheckoutSession, Order, OrderStatusHistory
from app.models.user import User
from tests.conftest import _TestSession

CART = "/v1/cart"
CHECKOUT = "/v1/checkout"
ORDERS = "/v1/orders"
SELLER_ORDERS = "/v1/seller/orders"
AUTH = "/v1/auth"
SELLER_PROD = "/v1/seller/products"

SAMPLE_ADDRESS = {
    "full_name": "Test Buyer",
    "phone": "03001234567",
    "address_line1": "123 Test Street",
    "city": "Karachi",
}


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
    token = (
        await client.post(f"{AUTH}/login", json={"email": email, "password": pw})
    ).json()["access_token"]
    return email, token


async def _nullify_buyer_refs(user_id: uuid.UUID, db) -> None:
    """Remove FK references so the buyer user row can be deleted."""
    await db.execute(
        update(Order).where(Order.buyer_id == user_id).values(buyer_id=None)
    )
    await db.execute(
        update(CheckoutSession)
        .where(CheckoutSession.buyer_id == user_id)
        .values(buyer_id=None)
    )
    await db.execute(
        update(OrderStatusHistory)
        .where(OrderStatusHistory.changed_by == user_id)
        .values(changed_by=None)
    )


async def _nullify_seller_refs(user_id: uuid.UUID, db) -> None:
    """Remove FK references so the seller user row can be deleted."""
    await db.execute(
        update(Order).where(Order.seller_id == user_id).values(seller_id=None)
    )
    # order_line_items.variant_id → product_variants (CASCADE from products → seller)
    # must nullify before the user delete triggers product cascade
    from sqlalchemy import select as sq
    from app.models.catalog import ProductVariant as PV
    from app.models.order import OrderLineItem
    v_ids = (
        await db.execute(
            sq(PV.id)
            .join(Product, PV.product_id == Product.id)
            .where(Product.seller_id == user_id)
        )
    ).scalars().all()
    if v_ids:
        await db.execute(
            update(OrderLineItem)
            .where(OrderLineItem.variant_id.in_(v_ids))
            .values(variant_id=None)
        )


@pytest.fixture
async def buyer(client):
    email, token = await _register_login(client, "consumer")
    me = (await client.get("/v1/users/me", headers={"Authorization": f"Bearer {token}"})).json()
    user_id = uuid.UUID(me["id"])
    yield {
        "email": email,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
        "id": user_id,
    }
    async with _TestSession() as db:
        await _nullify_buyer_refs(user_id, db)
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


@pytest.fixture
async def seller_with_product(client):
    email, token = await _register_login(client, "seller")
    hdrs = {"Authorization": f"Bearer {token}"}
    me = (await client.get("/v1/users/me", headers=hdrs)).json()
    user_id = uuid.UUID(me["id"])

    prod = (await client.post(
        SELLER_PROD, json={"title": "Checkout Widget"}, headers=hdrs
    )).json()
    pid = prod["id"]
    var = (await client.post(
        f"{SELLER_PROD}/{pid}/variants",
        json={"price": 200.0, "stock_qty": 10},
        headers=hdrs,
    )).json()

    async with _TestSession() as db:
        await db.execute(
            update(Product).where(Product.id == uuid.UUID(pid)).values(status="published")
        )
        await db.commit()

    yield {
        "email": email,
        "token": token,
        "headers": hdrs,
        "id": user_id,
        "product_id": pid,
        "variant_id": var["id"],
    }

    async with _TestSession() as db:
        await _nullify_seller_refs(user_id, db)
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


@pytest.fixture
async def seller2_with_product(client):
    email, token = await _register_login(client, "seller")
    hdrs = {"Authorization": f"Bearer {token}"}
    me = (await client.get("/v1/users/me", headers=hdrs)).json()
    user_id = uuid.UUID(me["id"])

    prod = (await client.post(
        SELLER_PROD, json={"title": "Checkout Widget B"}, headers=hdrs
    )).json()
    pid = prod["id"]
    var = (await client.post(
        f"{SELLER_PROD}/{pid}/variants",
        json={"price": 150.0, "stock_qty": 10},
        headers=hdrs,
    )).json()

    async with _TestSession() as db:
        await db.execute(
            update(Product).where(Product.id == uuid.UUID(pid)).values(status="published")
        )
        await db.commit()

    yield {
        "email": email,
        "token": token,
        "headers": hdrs,
        "id": user_id,
        "product_id": pid,
        "variant_id": var["id"],
    }

    async with _TestSession() as db:
        await _nullify_seller_refs(user_id, db)
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_empty_cart_checkout(client, buyer):
    resp = await client.post(
        CHECKOUT,
        json={"address": SAMPLE_ADDRESS, "payment_method": "cod"},
        headers=buyer["headers"],
    )
    assert resp.status_code == 400


async def test_single_seller_checkout_cod(client, buyer, seller_with_product):
    hdrs = buyer["headers"]
    vid = seller_with_product["variant_id"]

    await client.post(f"{CART}/items", json={"variant_id": vid, "quantity": 2}, headers=hdrs)

    resp = await client.post(
        CHECKOUT,
        json={"address": SAMPLE_ADDRESS, "payment_method": "cod"},
        headers=hdrs,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["total_orders"] == 1
    assert data["orders"][0]["status"] == "payment_confirmed"

    cart = (await client.get(CART, headers=hdrs)).json()
    assert cart["item_count"] == 0

    async with _TestSession() as db:
        var = (
            await db.execute(
                select(ProductVariant).where(ProductVariant.id == uuid.UUID(vid))
            )
        ).scalar_one()
        assert var.stock_qty == 8  # 10 - 2


async def test_multi_seller_checkout(client, buyer, seller_with_product, seller2_with_product):
    hdrs = buyer["headers"]

    await client.post(
        f"{CART}/items",
        json={"variant_id": seller_with_product["variant_id"], "quantity": 1},
        headers=hdrs,
    )
    await client.post(
        f"{CART}/items",
        json={"variant_id": seller2_with_product["variant_id"], "quantity": 1},
        headers=hdrs,
    )

    resp = await client.post(
        CHECKOUT,
        json={"address": SAMPLE_ADDRESS, "payment_method": "bank_transfer"},
        headers=hdrs,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["total_orders"] == 2
    assert len({o["id"] for o in data["orders"]}) == 2


async def test_get_buyer_orders(client, buyer, seller_with_product):
    hdrs = buyer["headers"]
    vid = seller_with_product["variant_id"]

    await client.post(f"{CART}/items", json={"variant_id": vid, "quantity": 1}, headers=hdrs)
    await client.post(
        CHECKOUT, json={"address": SAMPLE_ADDRESS, "payment_method": "cod"}, headers=hdrs
    )

    resp = await client.get(ORDERS, headers=hdrs)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert len(data["items"]) >= 1


async def test_get_seller_orders(client, buyer, seller_with_product):
    buyer_hdrs = buyer["headers"]
    seller_hdrs = seller_with_product["headers"]
    vid = seller_with_product["variant_id"]

    await client.post(f"{CART}/items", json={"variant_id": vid, "quantity": 1}, headers=buyer_hdrs)
    checkout = (
        await client.post(
            CHECKOUT,
            json={"address": SAMPLE_ADDRESS, "payment_method": "cod"},
            headers=buyer_hdrs,
        )
    ).json()
    order_id = checkout["orders"][0]["id"]

    list_resp = await client.get(SELLER_ORDERS, headers=seller_hdrs)
    assert list_resp.status_code == 200
    ids = [o["id"] for o in list_resp.json()["items"]]
    assert order_id in ids

    detail_resp = await client.get(f"{SELLER_ORDERS}/{order_id}", headers=seller_hdrs)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["id"] == order_id
