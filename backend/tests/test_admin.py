import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.user import SellerProfile, User
from tests.conftest import _TestSession

AUTH = "/v1/auth"
ADMIN = "/v1/admin"
SELLER_PROD = "/v1/seller/products"


def _email(prefix="user"):
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


async def _create_admin() -> tuple[str, str]:
    """Insert admin user directly into DB (bypasses role Literal validator)."""
    email = _email("admin")
    user_id = uuid.uuid4()
    async with _TestSession() as db:
        db.add(User(
            id=user_id,
            email=email,
            password_hash=hash_password("Pass123!"),
            role="admin",
        ))
        await db.commit()
    token = create_access_token(str(user_id), "admin")
    return email, token


@pytest.fixture
async def admin_token():
    email, token = await _create_admin()
    yield {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}
    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


@pytest.fixture
async def seller_under_review(client):
    email, token = await _register_login(client, "seller")
    me = (await client.get("/v1/users/me", headers={"Authorization": f"Bearer {token}"})).json()
    user_id = uuid.UUID(me["id"])
    hdrs = {"Authorization": f"Bearer {token}"}

    async with _TestSession() as db:
        db.add(SellerProfile(
            user_id=user_id,
            store_name="Review Store",
            store_slug=f"review-{uuid.uuid4().hex[:8]}",
        ))
        await db.commit()

    prod = (await client.post(SELLER_PROD, json={"title": "Admin Test Product"}, headers=hdrs)).json()
    pid = prod["id"]
    await client.put(f"{SELLER_PROD}/{pid}/publish", headers=hdrs)

    yield {"email": email, "token": token, "id": str(user_id), "product_id": pid}

    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_non_admin_forbidden(client):
    email, token = await _register_login(client, "consumer")
    resp = await client.get(f"{ADMIN}/products", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


async def test_admin_approves_product(client, admin_token, seller_under_review):
    pid = seller_under_review["product_id"]
    resp = await client.put(f"{ADMIN}/products/{pid}/approve", headers=admin_token["headers"])
    assert resp.status_code == 200
    assert resp.json()["status"] == "published"


async def test_admin_rejects_product(client, admin_token, seller_under_review):
    pid = seller_under_review["product_id"]
    resp = await client.put(
        f"{ADMIN}/products/{pid}/reject",
        json={"reason": "Poor quality images"},
        headers=admin_token["headers"],
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "draft"
    assert data["rejection_reason"] == "Poor quality images"


async def test_admin_approves_seller(client, admin_token, seller_under_review):
    sid = seller_under_review["id"]
    resp = await client.put(f"{ADMIN}/sellers/{sid}/approve", headers=admin_token["headers"])
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"
