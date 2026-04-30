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
    "full_name": "FSM Buyer",
    "phone": "03001234567",
    "address_line1": "1 FSM Street",
    "city": "Lahore",
}


def _email(prefix="fsm"):
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


async def _nullify_buyer_refs(user_id, db):
    await db.execute(update(Order).where(Order.buyer_id == user_id).values(buyer_id=None))
    await db.execute(update(CheckoutSession).where(CheckoutSession.buyer_id == user_id).values(buyer_id=None))
    await db.execute(update(OrderStatusHistory).where(OrderStatusHistory.changed_by == user_id).values(changed_by=None))


async def _nullify_seller_refs(user_id, db):
    await db.execute(update(Order).where(Order.seller_id == user_id).values(seller_id=None))
    await db.execute(
        update(OrderStatusHistory).where(OrderStatusHistory.changed_by == user_id).values(changed_by=None)
    )
    v_ids = (
        await db.execute(
            select(ProductVariant.id)
            .join(Product, ProductVariant.product_id == Product.id)
            .where(Product.seller_id == user_id)
        )
    ).scalars().all()
    if v_ids:
        from app.models.order import OrderLineItem
        await db.execute(
            update(OrderLineItem).where(OrderLineItem.variant_id.in_(v_ids)).values(variant_id=None)
        )


@pytest.fixture
async def buyer(client):
    email, token = await _register_login(client, "consumer")
    me = (await client.get("/v1/users/me", headers={"Authorization": f"Bearer {token}"})).json()
    user_id = uuid.UUID(me["id"])
    yield {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}, "id": user_id}
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

    prod = (await client.post(SELLER_PROD, json={"title": "FSM Widget"}, headers=hdrs)).json()
    pid = prod["id"]
    var = (await client.post(
        f"{SELLER_PROD}/{pid}/variants",
        json={"price": 300.0, "stock_qty": 20},
        headers=hdrs,
    )).json()

    async with _TestSession() as db:
        await db.execute(update(Product).where(Product.id == uuid.UUID(pid)).values(status="published"))
        await db.commit()

    yield {"email": email, "token": token, "headers": hdrs, "id": user_id,
           "product_id": pid, "variant_id": var["id"]}

    async with _TestSession() as db:
        await _nullify_seller_refs(user_id, db)
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


async def _place_order(client, buyer, seller_with_product):
    hdrs = buyer["headers"]
    vid = seller_with_product["variant_id"]
    await client.post(f"{CART}/items", json={"variant_id": vid, "quantity": 2}, headers=hdrs)
    resp = await client.post(
        CHECKOUT,
        json={"address": SAMPLE_ADDRESS, "payment_method": "cod"},
        headers=hdrs,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["orders"][0]["id"]


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_seller_advances_order(client, buyer, seller_with_product):
    order_id = await _place_order(client, buyer, seller_with_product)
    shdrs = seller_with_product["headers"]

    # payment_confirmed → processing
    r = await client.put(f"{SELLER_ORDERS}/{order_id}/advance", json={}, headers=shdrs)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "processing"

    # processing → packed
    r = await client.put(f"{SELLER_ORDERS}/{order_id}/advance", json={}, headers=shdrs)
    assert r.status_code == 200
    assert r.json()["status"] == "packed"

    # packed → shipped (requires tracking_number)
    r = await client.put(
        f"{SELLER_ORDERS}/{order_id}/advance",
        json={"tracking_number": "TRK-001"},
        headers=shdrs,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "shipped"
    assert data["tracking_number"] == "TRK-001"

    # shipped → out_for_delivery
    r = await client.put(f"{SELLER_ORDERS}/{order_id}/advance", json={}, headers=shdrs)
    assert r.status_code == 200
    assert r.json()["status"] == "out_for_delivery"

    # out_for_delivery → delivered
    r = await client.put(f"{SELLER_ORDERS}/{order_id}/advance", json={}, headers=shdrs)
    assert r.status_code == 200
    assert r.json()["status"] == "delivered"


async def test_advance_to_shipped_without_tracking(client, buyer, seller_with_product):
    order_id = await _place_order(client, buyer, seller_with_product)
    shdrs = seller_with_product["headers"]

    # advance to packed
    await client.put(f"{SELLER_ORDERS}/{order_id}/advance", json={}, headers=shdrs)
    await client.put(f"{SELLER_ORDERS}/{order_id}/advance", json={}, headers=shdrs)

    # attempt shipped without tracking_number → 422
    r = await client.put(f"{SELLER_ORDERS}/{order_id}/advance", json={}, headers=shdrs)
    assert r.status_code == 422, r.text


async def test_buyer_cancel_order(client, buyer, seller_with_product):
    order_id = await _place_order(client, buyer, seller_with_product)
    shdrs = seller_with_product["headers"]
    bhdrs = buyer["headers"]

    # advance to processing
    await client.put(f"{SELLER_ORDERS}/{order_id}/advance", json={}, headers=shdrs)

    # buyer requests cancellation
    r = await client.put(f"{ORDERS}/{order_id}/cancel", headers=bhdrs)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "cancel_requested"


async def test_seller_accept_cancel_restores_stock(client, buyer, seller_with_product):
    vid = seller_with_product["variant_id"]
    order_id = await _place_order(client, buyer, seller_with_product)
    shdrs = seller_with_product["headers"]
    bhdrs = buyer["headers"]

    # check stock was decremented (placed 2 items)
    async with _TestSession() as db:
        variant = (await db.execute(select(ProductVariant).where(ProductVariant.id == uuid.UUID(vid)))).scalar_one()
        stock_after_order = variant.stock_qty  # should be 18

    # advance to processing then buyer cancels
    await client.put(f"{SELLER_ORDERS}/{order_id}/advance", json={}, headers=shdrs)
    await client.put(f"{ORDERS}/{order_id}/cancel", headers=bhdrs)

    # seller accepts cancel
    r = await client.put(f"{SELLER_ORDERS}/{order_id}/cancel", headers=shdrs)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "cancelled"

    # stock should be restored
    async with _TestSession() as db:
        variant = (await db.execute(select(ProductVariant).where(ProductVariant.id == uuid.UUID(vid)))).scalar_one()
        assert variant.stock_qty == stock_after_order + 2
