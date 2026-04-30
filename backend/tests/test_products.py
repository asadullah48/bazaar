import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.main import app
from app.models.user import User
from tests.conftest import _TestSession

PROD = "/v1/seller/products"
AUTH = "/v1/auth"


def _email(prefix: str = "seller") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}@test.dev"


# ── shared fixtures ───────────────────────────────────────────────────────────

@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def _make_seller(client: AsyncClient):
    email = _email("seller")
    pw = "Seller123!"
    r = await client.post(f"{AUTH}/register", json={"email": email, "password": pw, "role": "seller"})
    assert r.status_code == 201
    token = (await client.post(f"{AUTH}/login", json={"email": email, "password": pw})).json()["access_token"]
    user_id = (await client.get("/v1/users/me", headers={"Authorization": f"Bearer {token}"})).json()["id"]
    return {"email": email, "token": token, "id": user_id}


@pytest.fixture
async def seller_a(client: AsyncClient):
    data = await _make_seller(client)
    yield data
    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == data["email"]))
        await db.commit()


@pytest.fixture
async def seller_b(client: AsyncClient):
    data = await _make_seller(client)
    yield data
    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == data["email"]))
        await db.commit()


@pytest.fixture
async def product_a(client: AsyncClient, seller_a):
    resp = await client.post(
        PROD,
        json={"title": "Test Widget", "condition": "new"},
        headers={"Authorization": f"Bearer {seller_a['token']}"},
    )
    assert resp.status_code == 201
    return resp.json()


# ── Task 6a: product CRUD ─────────────────────────────────────────────────────

async def test_seller_creates_product(client: AsyncClient, seller_a):
    resp = await client.post(
        PROD,
        json={"title": "My First Product", "condition": "new", "brand": "Acme"},
        headers={"Authorization": f"Bearer {seller_a['token']}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "draft"
    assert data["title"] == "My First Product"
    assert data["seller_id"] == seller_a["id"]


async def test_seller_lists_products(client: AsyncClient, seller_a, product_a):
    resp = await client.get(PROD, headers={"Authorization": f"Bearer {seller_a['token']}"})
    assert resp.status_code == 200
    ids = [p["id"] for p in resp.json()]
    assert product_a["id"] in ids


async def test_non_owner_cannot_update(client: AsyncClient, seller_b, product_a):
    resp = await client.put(
        f"{PROD}/{product_a['id']}",
        json={"title": "Hijacked"},
        headers={"Authorization": f"Bearer {seller_b['token']}"},
    )
    assert resp.status_code == 403


async def test_seller_publishes(client: AsyncClient, seller_a, product_a):
    resp = await client.put(
        f"{PROD}/{product_a['id']}/publish",
        headers={"Authorization": f"Bearer {seller_a['token']}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "under_review"


async def test_seller_deletes(client: AsyncClient, seller_a, product_a):
    del_resp = await client.delete(
        f"{PROD}/{product_a['id']}",
        headers={"Authorization": f"Bearer {seller_a['token']}"},
    )
    assert del_resp.status_code == 200

    # Still in DB, status=archived
    get_resp = await client.get(
        f"{PROD}/{product_a['id']}",
        headers={"Authorization": f"Bearer {seller_a['token']}"},
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["status"] == "archived"


# ── Task 6b: variants ─────────────────────────────────────────────────────────

async def test_add_variants(client: AsyncClient, seller_a, product_a):
    pid = product_a["id"]
    hdrs = {"Authorization": f"Bearer {seller_a['token']}"}

    r1 = await client.post(f"{PROD}/{pid}/variants",
                           json={"price": 100.0, "option1_name": "Color", "option1_value": "Red"}, headers=hdrs)
    r2 = await client.post(f"{PROD}/{pid}/variants",
                           json={"price": 120.0, "option1_name": "Color", "option1_value": "Blue"}, headers=hdrs)
    assert r1.status_code == 201
    assert r2.status_code == 201

    list_resp = await client.get(f"{PROD}/{pid}/variants", headers=hdrs)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 2


async def test_update_variant_price(client: AsyncClient, seller_a, product_a):
    pid = product_a["id"]
    hdrs = {"Authorization": f"Bearer {seller_a['token']}"}

    vid = (await client.post(f"{PROD}/{pid}/variants", json={"price": 50.0}, headers=hdrs)).json()["id"]

    upd = await client.put(f"{PROD}/{pid}/variants/{vid}", json={"price": 75.0}, headers=hdrs)
    assert upd.status_code == 200
    assert upd.json()["price"] == 75.0


async def test_delete_variant(client: AsyncClient, seller_a, product_a):
    pid = product_a["id"]
    hdrs = {"Authorization": f"Bearer {seller_a['token']}"}

    v1 = (await client.post(f"{PROD}/{pid}/variants", json={"price": 10.0}, headers=hdrs)).json()["id"]
    v2 = (await client.post(f"{PROD}/{pid}/variants", json={"price": 20.0}, headers=hdrs)).json()["id"]

    del_resp = await client.delete(f"{PROD}/{pid}/variants/{v1}", headers=hdrs)
    assert del_resp.status_code == 200
    assert del_resp.json()["is_active"] is False

    active = await client.get(f"{PROD}/{pid}/variants", headers=hdrs)
    ids = [v["id"] for v in active.json()]
    assert v1 not in ids
    assert v2 in ids


# ── Task 6c: B2B tiers ────────────────────────────────────────────────────────

async def test_add_b2b_tiers(client: AsyncClient, seller_a):
    # Create a B2B-eligible product
    p = (await client.post(
        PROD,
        json={"title": "B2B Widget", "is_b2b_eligible": True, "b2b_moq": 10},
        headers={"Authorization": f"Bearer {seller_a['token']}"},
    )).json()
    pid = p["id"]
    hdrs = {"Authorization": f"Bearer {seller_a['token']}"}

    t1 = await client.post(f"{PROD}/{pid}/tiers",
                           json={"min_qty": 10, "max_qty": 49, "price_per_unit": 90.0, "sort_order": 1},
                           headers=hdrs)
    t2 = await client.post(f"{PROD}/{pid}/tiers",
                           json={"min_qty": 50, "price_per_unit": 80.0, "sort_order": 2},
                           headers=hdrs)
    assert t1.status_code == 201
    assert t2.status_code == 201

    resp = await client.get(f"{PROD}/{pid}/tiers", headers=hdrs)
    assert resp.status_code == 200
    tiers = resp.json()
    assert len(tiers) == 2
    assert tiers[0]["sort_order"] < tiers[1]["sort_order"]


async def test_delete_tier(client: AsyncClient, seller_a):
    p = (await client.post(
        PROD,
        json={"title": "Tier Delete Test", "is_b2b_eligible": True},
        headers={"Authorization": f"Bearer {seller_a['token']}"},
    )).json()
    pid = p["id"]
    hdrs = {"Authorization": f"Bearer {seller_a['token']}"}

    tier1_id = (await client.post(f"{PROD}/{pid}/tiers",
                                  json={"min_qty": 5, "price_per_unit": 95.0, "sort_order": 1},
                                  headers=hdrs)).json()["id"]
    await client.post(f"{PROD}/{pid}/tiers",
                      json={"min_qty": 20, "price_per_unit": 85.0, "sort_order": 2},
                      headers=hdrs)

    del_resp = await client.delete(f"{PROD}/{pid}/tiers/{tier1_id}", headers=hdrs)
    assert del_resp.status_code == 204

    remaining = await client.get(f"{PROD}/{pid}/tiers", headers=hdrs)
    assert len(remaining.json()) == 1
