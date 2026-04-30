import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select, update

from app.main import app
from app.models.catalog import Product, ProductVariant
from app.models.order import CheckoutSession, Order, OrderStatusHistory
from app.models.user import SellerProfile, User
from tests.conftest import _TestSession

CART = "/v1/cart"
CHECKOUT = "/v1/checkout"
SELLER_ORDERS = "/v1/seller/orders"
AUTH = "/v1/auth"
SELLER_PROD = "/v1/seller/products"
REVIEWS = "/v1/reviews"

SAMPLE_ADDRESS = {
    "full_name": "Reviewer",
    "phone": "03001234567",
    "address_line1": "1 Review Lane",
    "city": "Islamabad",
}


def _email(prefix="rv"):
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
    from app.models.review import Review
    await db.execute(update(Order).where(Order.buyer_id == user_id).values(buyer_id=None))
    await db.execute(update(CheckoutSession).where(CheckoutSession.buyer_id == user_id).values(buyer_id=None))
    await db.execute(update(OrderStatusHistory).where(OrderStatusHistory.changed_by == user_id).values(changed_by=None))
    await db.execute(update(Review).where(Review.buyer_id == user_id).values(buyer_id=None))


async def _nullify_seller_refs(user_id, db):
    from app.models.review import Review
    # Nullify review FKs before the product/order cascade wipes the referenced rows
    p_ids = (
        await db.execute(select(Product.id).where(Product.seller_id == user_id))
    ).scalars().all()
    if p_ids:
        await db.execute(update(Review).where(Review.product_id.in_(p_ids)).values(product_id=None))
    await db.execute(update(Review).where(Review.seller_id == user_id).values(seller_id=None))
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
    slug = f"rv-store-{uuid.uuid4().hex[:8]}"

    async with _TestSession() as db:
        db.add(SellerProfile(
            user_id=user_id,
            store_name="Review Test Store",
            store_slug=slug,
            status="approved",
            total_rating=0.0,
            review_count=0,
        ))
        await db.commit()

    prod = (await client.post(SELLER_PROD, json={"title": "Review Widget"}, headers=hdrs)).json()
    pid = prod["id"]
    var = (await client.post(
        f"{SELLER_PROD}/{pid}/variants",
        json={"price": 500.0, "stock_qty": 30},
        headers=hdrs,
    )).json()

    async with _TestSession() as db:
        await db.execute(update(Product).where(Product.id == uuid.UUID(pid)).values(status="published"))
        await db.commit()

    yield {"email": email, "token": token, "headers": hdrs, "id": user_id,
           "product_id": pid, "variant_id": var["id"], "slug": slug}

    async with _TestSession() as db:
        await _nullify_seller_refs(user_id, db)
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


async def _place_and_complete_order(client, buyer, seller_with_product):
    """Place an order and advance it to 'completed' status."""
    hdrs = buyer["headers"]
    shdrs = seller_with_product["headers"]
    vid = seller_with_product["variant_id"]

    await client.post(f"{CART}/items", json={"variant_id": vid, "quantity": 1}, headers=hdrs)
    resp = await client.post(
        CHECKOUT, json={"address": SAMPLE_ADDRESS, "payment_method": "cod"}, headers=hdrs
    )
    assert resp.status_code == 200, resp.text
    order_id = resp.json()["orders"][0]["id"]

    # Advance through all states to completed
    for _ in range(3):  # payment_confirmed → processing → packed
        await client.put(f"{SELLER_ORDERS}/{order_id}/advance", json={}, headers=shdrs)

    # packed → shipped (requires tracking)
    await client.put(
        f"{SELLER_ORDERS}/{order_id}/advance",
        json={"tracking_number": "TRK-REV-001"},
        headers=shdrs,
    )
    # shipped → out_for_delivery → delivered → completed
    for _ in range(3):
        await client.put(f"{SELLER_ORDERS}/{order_id}/advance", json={}, headers=shdrs)

    return order_id


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_cannot_review_non_completed_order(client, buyer, seller_with_product):
    hdrs = buyer["headers"]
    vid = seller_with_product["variant_id"]
    pid = seller_with_product["product_id"]

    await client.post(f"{CART}/items", json={"variant_id": vid, "quantity": 1}, headers=hdrs)
    resp = await client.post(
        CHECKOUT, json={"address": SAMPLE_ADDRESS, "payment_method": "cod"}, headers=hdrs
    )
    order_id = resp.json()["orders"][0]["id"]

    r = await client.post(REVIEWS, json={
        "order_id": order_id,
        "product_id": pid,
        "rating": 5,
        "body": "This is a great product really awesome",
    }, headers=hdrs)
    assert r.status_code == 403, r.text


async def test_create_review_on_completed_order(client, buyer, seller_with_product):
    hdrs = buyer["headers"]
    pid = seller_with_product["product_id"]
    seller_id = str(seller_with_product["id"])

    order_id = await _place_and_complete_order(client, buyer, seller_with_product)

    r = await client.post(REVIEWS, json={
        "order_id": order_id,
        "product_id": pid,
        "rating": 4,
        "body": "Great product, very satisfied with the quality and packaging",
        "product_accuracy": 4,
        "packaging_quality": 5,
    }, headers=hdrs)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["rating"] == 4
    assert data["seller_id"] == seller_id
    assert data["buyer_id"] == str(buyer["id"])


async def test_duplicate_review_returns_409(client, buyer, seller_with_product):
    hdrs = buyer["headers"]
    pid = seller_with_product["product_id"]

    order_id = await _place_and_complete_order(client, buyer, seller_with_product)

    review_body = {
        "order_id": order_id,
        "product_id": pid,
        "rating": 3,
        "body": "Decent product, would consider buying again if price drops",
    }

    r1 = await client.post(REVIEWS, json=review_body, headers=hdrs)
    assert r1.status_code == 201

    r2 = await client.post(REVIEWS, json=review_body, headers=hdrs)
    assert r2.status_code == 409, r2.text


async def test_content_guard_blocks_email_in_body(client, buyer, seller_with_product):
    hdrs = buyer["headers"]
    pid = seller_with_product["product_id"]

    order_id = await _place_and_complete_order(client, buyer, seller_with_product)

    r = await client.post(REVIEWS, json={
        "order_id": order_id,
        "product_id": pid,
        "rating": 5,
        "body": "Contact me at buyer@example.com for wholesale deals on this product",
    }, headers=hdrs)
    assert r.status_code == 400, r.text


async def test_get_product_reviews(client, buyer, seller_with_product):
    hdrs = buyer["headers"]
    pid = seller_with_product["product_id"]

    order_id = await _place_and_complete_order(client, buyer, seller_with_product)

    await client.post(REVIEWS, json={
        "order_id": order_id,
        "product_id": pid,
        "rating": 5,
        "body": "Excellent product, highly recommend to everyone looking for quality",
    }, headers=hdrs)

    r = await client.get(f"/v1/products/{pid}/reviews")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] >= 1
    assert any(rv["rating"] == 5 for rv in data["items"])


async def test_seller_rating_updated_after_review(client, buyer, seller_with_product):
    hdrs = buyer["headers"]
    pid = seller_with_product["product_id"]
    seller_user_id = seller_with_product["id"]

    async with _TestSession() as db:
        sp_before = (
            await db.execute(select(SellerProfile).where(SellerProfile.user_id == seller_user_id))
        ).scalar_one_or_none()
        old_count = sp_before.review_count if sp_before else 0

    order_id = await _place_and_complete_order(client, buyer, seller_with_product)

    await client.post(REVIEWS, json={
        "order_id": order_id,
        "product_id": pid,
        "rating": 5,
        "body": "Perfect product, fast delivery and great quality overall",
    }, headers=hdrs)

    async with _TestSession() as db:
        sp_after = (
            await db.execute(select(SellerProfile).where(SellerProfile.user_id == seller_user_id))
        ).scalar_one_or_none()
        assert sp_after.review_count == old_count + 1
        assert float(sp_after.total_rating) > 0
