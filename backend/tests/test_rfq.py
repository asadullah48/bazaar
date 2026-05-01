import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.main import app
from app.models.user import User
from app.models.rfq import RFQ
from tests.conftest import _TestSession

AUTH = "/v1/auth"
RFQS = "/v1/rfqs"


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


@pytest.fixture
async def buyer(client):
    email, token = await _register_login(client, "consumer")
    me = (await client.get("/v1/users/me", headers={"Authorization": f"Bearer {token}"})).json()
    user_id = uuid.UUID(me["id"])
    yield {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}, "id": user_id}
    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


@pytest.fixture
async def seller(client):
    email, token = await _register_login(client, "seller")
    me = (await client.get("/v1/users/me", headers={"Authorization": f"Bearer {token}"})).json()
    user_id = uuid.UUID(me["id"])
    yield {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}, "id": user_id}
    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


# ── Task 11a tests ─────────────────────────────────────────────────────────────

async def test_buyer_creates_rfq(client, buyer):
    resp = await client.post(
        RFQS,
        json={"title": "Need 500 shirts", "quantity": 500, "target_price": 10.0},
        headers=buyer["headers"],
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["status"] == "open"
    assert data["expires_at"] is not None
    assert data["buyer_id"] == str(buyer["id"])
    async with _TestSession() as db:
        await db.execute(delete(RFQ).where(RFQ.id == uuid.UUID(data["id"])))
        await db.commit()


async def test_buyer_lists_own_rfqs(client, buyer):
    r = await client.post(
        RFQS,
        json={"title": "Buyer list test", "quantity": 100},
        headers=buyer["headers"],
    )
    rfq_id = uuid.UUID(r.json()["id"])

    resp = await client.get(RFQS, headers=buyer["headers"])
    assert resp.status_code == 200
    ids = [item["id"] for item in resp.json()["items"]]
    assert str(rfq_id) in ids

    async with _TestSession() as db:
        await db.execute(delete(RFQ).where(RFQ.id == rfq_id))
        await db.commit()


async def test_seller_sees_broadcast_rfq(client, buyer, seller):
    r = await client.post(
        RFQS,
        json={"title": "Broadcast RFQ", "quantity": 200},
        headers=buyer["headers"],
    )
    rfq_id = uuid.UUID(r.json()["id"])

    resp = await client.get(RFQS, headers=seller["headers"])
    assert resp.status_code == 200
    ids = [item["id"] for item in resp.json()["items"]]
    assert str(rfq_id) in ids

    async with _TestSession() as db:
        await db.execute(delete(RFQ).where(RFQ.id == rfq_id))
        await db.commit()


async def test_buyer_closes_rfq(client, buyer):
    r = await client.post(
        RFQS,
        json={"title": "To close", "quantity": 50},
        headers=buyer["headers"],
    )
    rfq_id = r.json()["id"]

    resp = await client.delete(f"{RFQS}/{rfq_id}", headers=buyer["headers"])
    assert resp.status_code == 204

    # cannot re-close
    resp2 = await client.delete(f"{RFQS}/{rfq_id}", headers=buyer["headers"])
    assert resp2.status_code == 400

    async with _TestSession() as db:
        await db.execute(delete(RFQ).where(RFQ.id == uuid.UUID(rfq_id)))
        await db.commit()


# ── Task 11b tests ─────────────────────────────────────────────────────────────

async def test_seller_submits_quote_visible_to_buyer(client, buyer, seller):
    r = await client.post(
        RFQS,
        json={"title": "Quote visibility test", "quantity": 100},
        headers=buyer["headers"],
    )
    rfq_id = r.json()["id"]

    q = await client.post(
        f"{RFQS}/{rfq_id}/quotes",
        json={"unit_price": 50.0, "lead_time_days": 7},
        headers=seller["headers"],
    )
    assert q.status_code == 201, q.text
    quote_id = q.json()["id"]

    quotes = await client.get(f"{RFQS}/{rfq_id}/quotes", headers=buyer["headers"])
    assert quotes.status_code == 200
    ids = [qr["id"] for qr in quotes.json()]
    assert quote_id in ids

    rfq_resp = await client.get(f"{RFQS}/{rfq_id}", headers=buyer["headers"])
    assert rfq_resp.json()["status"] == "quoted"

    async with _TestSession() as db:
        await db.execute(delete(RFQ).where(RFQ.id == uuid.UUID(rfq_id)))
        await db.commit()


async def test_buyer_counters_quote(client, buyer, seller):
    r = await client.post(
        RFQS,
        json={"title": "Counter test", "quantity": 100},
        headers=buyer["headers"],
    )
    rfq_id = r.json()["id"]

    q = await client.post(
        f"{RFQS}/{rfq_id}/quotes",
        json={"unit_price": 50.0, "lead_time_days": 7},
        headers=seller["headers"],
    )
    quote_id = q.json()["id"]

    counter_resp = await client.put(
        f"{RFQS}/{rfq_id}/quotes/{quote_id}/counter",
        json={"counter_price": 40.0},
        headers=buyer["headers"],
    )
    assert counter_resp.status_code == 200, counter_resp.text
    assert counter_resp.json()["status"] == "countered"
    assert counter_resp.json()["counter_price"] == 40.0

    rfq_resp = await client.get(f"{RFQS}/{rfq_id}", headers=buyer["headers"])
    assert rfq_resp.json()["status"] == "negotiating"

    async with _TestSession() as db:
        await db.execute(delete(RFQ).where(RFQ.id == uuid.UUID(rfq_id)))
        await db.commit()


async def test_buyer_accepts_creates_order_and_rejects_others(client, buyer, seller):
    from app.models.order import Order

    r = await client.post(
        RFQS,
        json={"title": "Accept test", "quantity": 10, "delivery_city": "Lahore"},
        headers=buyer["headers"],
    )
    rfq_id = r.json()["id"]

    q = await client.post(
        f"{RFQS}/{rfq_id}/quotes",
        json={"unit_price": 100.0, "lead_time_days": 5},
        headers=seller["headers"],
    )
    quote_id = q.json()["id"]

    await client.put(
        f"{RFQS}/{rfq_id}/quotes/{quote_id}/counter",
        json={"counter_price": 80.0},
        headers=buyer["headers"],
    )

    accept_resp = await client.put(
        f"{RFQS}/{rfq_id}/quotes/{quote_id}/accept",
        headers=buyer["headers"],
    )
    assert accept_resp.status_code == 200, accept_resp.text
    data = accept_resp.json()
    assert "order_id" in data
    assert data["total_amount"] == 800.0  # 10 * 80.0

    rfq_resp = await client.get(f"{RFQS}/{rfq_id}", headers=buyer["headers"])
    assert rfq_resp.json()["status"] == "accepted"

    async with _TestSession() as db:
        order_id = uuid.UUID(data["order_id"])
        await db.execute(delete(Order).where(Order.id == order_id))
        await db.execute(delete(RFQ).where(RFQ.id == uuid.UUID(rfq_id)))
        await db.commit()


async def test_buyer_rejects_quote(client, buyer, seller):
    r = await client.post(
        RFQS,
        json={"title": "Reject test", "quantity": 50},
        headers=buyer["headers"],
    )
    rfq_id = r.json()["id"]

    q = await client.post(
        f"{RFQS}/{rfq_id}/quotes",
        json={"unit_price": 20.0, "lead_time_days": 3},
        headers=seller["headers"],
    )
    quote_id = q.json()["id"]

    reject_resp = await client.put(
        f"{RFQS}/{rfq_id}/quotes/{quote_id}/reject",
        headers=buyer["headers"],
    )
    assert reject_resp.status_code == 204

    quotes = await client.get(f"{RFQS}/{rfq_id}/quotes", headers=buyer["headers"])
    assert quotes.json()[0]["status"] == "rejected"

    async with _TestSession() as db:
        await db.execute(delete(RFQ).where(RFQ.id == uuid.UUID(rfq_id)))
        await db.commit()


async def test_seller_cannot_quote_twice(client, buyer, seller):
    r = await client.post(
        RFQS,
        json={"title": "Duplicate quote test", "quantity": 30},
        headers=buyer["headers"],
    )
    rfq_id = r.json()["id"]

    await client.post(
        f"{RFQS}/{rfq_id}/quotes",
        json={"unit_price": 15.0, "lead_time_days": 4},
        headers=seller["headers"],
    )
    second = await client.post(
        f"{RFQS}/{rfq_id}/quotes",
        json={"unit_price": 12.0, "lead_time_days": 3},
        headers=seller["headers"],
    )
    assert second.status_code == 409

    async with _TestSession() as db:
        await db.execute(delete(RFQ).where(RFQ.id == uuid.UUID(rfq_id)))
        await db.commit()
