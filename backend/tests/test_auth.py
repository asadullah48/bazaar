import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.main import app
from app.models.user import User
from tests.conftest import _TestSession

BASE = "/v1/auth"


def _email() -> str:
    return f"test_{uuid.uuid4().hex[:10]}@bazaar-test.dev"


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def registered_user(client: AsyncClient):
    email = _email()
    password = "Passw0rd!"
    resp = await client.post(f"{BASE}/register", json={
        "email": email, "password": password, "role": "consumer"
    })
    assert resp.status_code == 201
    yield {"email": email, "password": password, **resp.json()}

    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


# ── Task 5c: register ──────────────────────────────────────────────────────────

async def test_register_new_user(client: AsyncClient):
    email = _email()
    resp = await client.post(f"{BASE}/register", json={
        "email": email, "password": "Passw0rd!", "role": "consumer"
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == email
    assert data["role"] == "consumer"
    assert "id" in data

    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


async def test_register_duplicate_email(client: AsyncClient):
    email = _email()
    payload = {"email": email, "password": "Passw0rd!", "role": "consumer"}
    r1 = await client.post(f"{BASE}/register", json=payload)
    assert r1.status_code == 201

    r2 = await client.post(f"{BASE}/register", json=payload)
    assert r2.status_code == 409

    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


# ── Task 5d: login / refresh / logout ─────────────────────────────────────────

async def test_login_valid_credentials(registered_user, client: AsyncClient):
    resp = await client.post(f"{BASE}/login", json={
        "email": registered_user["email"],
        "password": registered_user["password"],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["role"] == "consumer"


async def test_login_wrong_password(registered_user, client: AsyncClient):
    resp = await client.post(f"{BASE}/login", json={
        "email": registered_user["email"],
        "password": "wrong_password",
    })
    assert resp.status_code == 401


async def test_refresh_returns_new_tokens(registered_user, client: AsyncClient):
    login = await client.post(f"{BASE}/login", json={
        "email": registered_user["email"],
        "password": registered_user["password"],
    })
    original_refresh = login.json()["refresh_token"]
    original_access = login.json()["access_token"]

    resp = await client.post(f"{BASE}/refresh", json={"refresh_token": original_refresh})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["refresh_token"] != original_refresh
    assert data["access_token"] != original_access


async def test_logout_deletes_token(registered_user, client: AsyncClient):
    login = await client.post(f"{BASE}/login", json={
        "email": registered_user["email"],
        "password": registered_user["password"],
    })
    refresh_token = login.json()["refresh_token"]

    logout = await client.post(f"{BASE}/logout", json={"refresh_token": refresh_token})
    assert logout.status_code == 204

    # Token must no longer work after logout
    resp = await client.post(f"{BASE}/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 401
