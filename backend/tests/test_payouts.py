import uuid
import pytest
from datetime import datetime, timezone
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.catalog import Category, Product, ProductVariant
from app.models.order import Order, OrderLineItem
from app.models.payout import PayoutLineItem, PayoutRecord
from app.models.user import User
from tests.conftest import _TestSession

AUTH = "/v1/auth"
ADMIN_PAYOUTS = "/v1/admin/payouts"
SELLER_PAYOUTS = "/v1/seller/payouts"


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
    me = (await client.get("/v1/users/me", headers={"Authorization": f"Bearer {token}"})).json()
    return email, token, uuid.UUID(me["id"])


async def _create_admin() -> tuple[str, str, uuid.UUID]:
    email = _email("admin")
    user_id = uuid.uuid4()
    async with _TestSession() as db:
        db.add(User(id=user_id, email=email, password_hash=hash_password("Pass123!"), role="admin"))
        await db.commit()
    token = create_access_token(str(user_id), "admin")
    return email, token, user_id


@pytest.fixture
async def admin_user(client):
    email, token, user_id = await _create_admin()
    yield {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}, "id": user_id}
    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


@pytest.fixture
async def seller_with_completed_order(client):
    """Creates a seller + completed order in a category with 10% commission."""
    seller_email, seller_token, seller_id = await _register_login(client, "seller")
    buyer_email, buyer_token, buyer_id = await _register_login(client, "consumer")

    async with _TestSession() as db:
        category = Category(
            name=f"Test Cat {uuid.uuid4().hex[:6]}",
            slug=f"test-cat-{uuid.uuid4().hex[:6]}",
            commission_rate=10.00,
        )
        db.add(category)
        await db.flush()

        product = Product(
            seller_id=seller_id,
            category_id=category.id,
            title="Payout Test Product",
            status="published",
        )
        db.add(product)
        await db.flush()

        variant = ProductVariant(
            product_id=product.id,
            price=1000.0,
            stock_qty=100,
        )
        db.add(variant)
        await db.flush()

        order = Order(
            order_number=f"BZR-2026-{uuid.uuid4().hex[:6].upper()}",
            buyer_id=buyer_id,
            seller_id=seller_id,
            payment_method="bank_transfer",
            payment_status="paid",
            subtotal=1000.0,
            shipping_cost=0,
            discount_amount=0,
            total_amount=1000.0,
            currency="PKR",
            delivery_address={"city": "Karachi"},
            status="completed",
        )
        db.add(order)
        await db.flush()

        db.add(OrderLineItem(
            order_id=order.id,
            variant_id=variant.id,
            product_snapshot={"title": "Payout Test Product"},
            quantity=1,
            unit_price=1000.0,
        ))
        await db.commit()

        order_id = order.id
        category_id = category.id
        product_id = product.id
        variant_id = variant.id

    yield {
        "seller_email": seller_email,
        "seller_token": seller_token,
        "seller_headers": {"Authorization": f"Bearer {seller_token}"},
        "seller_id": seller_id,
        "buyer_email": buyer_email,
        "buyer_id": buyer_id,
        "order_id": order_id,
        "order_total": 1000.0,
        "commission_rate": 10.0,
        "category_id": category_id,
        "product_id": product_id,
        "variant_id": variant_id,
    }

    async with _TestSession() as db:
        await db.execute(delete(PayoutLineItem).where(PayoutLineItem.order_id == order_id))
        await db.execute(delete(PayoutRecord).where(PayoutRecord.seller_id == seller_id))
        await db.execute(delete(Order).where(Order.id == order_id))
        await db.execute(delete(ProductVariant).where(ProductVariant.id == variant_id))
        await db.execute(delete(Product).where(Product.id == product_id))
        await db.execute(delete(Category).where(Category.id == category_id))
        await db.execute(delete(User).where(User.email == seller_email))
        await db.execute(delete(User).where(User.email == buyer_email))
        await db.commit()


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_calculate_payout_creates_record(client, admin_user, seller_with_completed_order):
    fixture = seller_with_completed_order

    resp = await client.post(
        f"{ADMIN_PAYOUTS}/calculate",
        json={
            "seller_id": str(fixture["seller_id"]),
            "period_start": "2026-01-01",
            "period_end": "2026-12-31",
        },
        headers=admin_user["headers"],
    )
    assert resp.status_code == 200, resp.text
    records = resp.json()
    assert len(records) >= 1
    record = next(r for r in records if r["seller_id"] == str(fixture["seller_id"]))
    assert record["status"] == "pending"
    assert record["gross_amount"] == 1000.0


async def test_commission_math_correct(client, admin_user, seller_with_completed_order):
    fixture = seller_with_completed_order
    order_total = fixture["order_total"]          # 1000.0
    commission_rate = fixture["commission_rate"]  # 10.0%

    resp = await client.post(
        f"{ADMIN_PAYOUTS}/calculate",
        json={
            "seller_id": str(fixture["seller_id"]),
            "period_start": "2026-01-01",
            "period_end": "2026-12-31",
        },
        headers=admin_user["headers"],
    )
    assert resp.status_code == 200, resp.text
    records = resp.json()
    record = next(r for r in records if r["seller_id"] == str(fixture["seller_id"]))

    expected_commission = order_total * commission_rate / 100   # 100.0
    expected_processing = order_total * 0.015                   # 15.0
    expected_net = order_total - expected_commission - expected_processing  # 885.0

    assert abs(record["net_amount"] - expected_net) < 0.01
    assert abs(record["commission_amount"] - expected_commission) < 0.01


async def test_mark_payout_paid(client, admin_user, seller_with_completed_order):
    fixture = seller_with_completed_order

    create_resp = await client.post(
        f"{ADMIN_PAYOUTS}/calculate",
        json={
            "seller_id": str(fixture["seller_id"]),
            "period_start": "2026-01-01",
            "period_end": "2026-12-31",
        },
        headers=admin_user["headers"],
    )
    record_id = next(
        r["id"] for r in create_resp.json()
        if r["seller_id"] == str(fixture["seller_id"])
    )

    paid_resp = await client.put(
        f"{ADMIN_PAYOUTS}/{record_id}/mark-paid",
        json={"bank_ref": "PKB-2026-001"},
        headers=admin_user["headers"],
    )
    assert paid_resp.status_code == 200, paid_resp.text
    assert paid_resp.json()["status"] == "paid"
    assert paid_resp.json()["bank_ref"] == "PKB-2026-001"


async def test_seller_views_own_payout_history(client, admin_user, seller_with_completed_order):
    fixture = seller_with_completed_order

    await client.post(
        f"{ADMIN_PAYOUTS}/calculate",
        json={
            "seller_id": str(fixture["seller_id"]),
            "period_start": "2026-01-01",
            "period_end": "2026-12-31",
        },
        headers=admin_user["headers"],
    )

    resp = await client.get(SELLER_PAYOUTS, headers=fixture["seller_headers"])
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) >= 1
    assert all(r["seller_id"] == str(fixture["seller_id"]) for r in items)
