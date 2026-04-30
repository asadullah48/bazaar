import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from jose import jwt
from sqlalchemy import delete

from app.core.config import get_settings
from app.main import app
from app.models.user import User
from tests.conftest import _TestSession

ME = "/v1/users/me"
AUTH = "/v1/auth"
settings = get_settings()


def _email():
    return f"utest_{uuid.uuid4().hex[:10]}@bazaar-test.dev"


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def auth_user(client: AsyncClient):
    email = _email()
    password = "Passw0rd!"
    await client.post(f"{AUTH}/register", json={"email": email, "password": password, "role": "consumer"})
    resp = await client.post(f"{AUTH}/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    yield {"email": email, "token": token}
    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


async def test_get_me_valid_token(auth_user, client: AsyncClient):
    resp = await client.get(ME, headers={"Authorization": f"Bearer {auth_user['token']}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == auth_user["email"]
    assert data["role"] == "consumer"
    assert "id" in data


async def test_get_me_no_token(client: AsyncClient):
    resp = await client.get(ME)
    assert resp.status_code == 401


async def test_get_me_expired_token(client: AsyncClient):
    expired = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "role": "consumer",
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
            "jti": uuid.uuid4().hex,
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    resp = await client.get(ME, headers={"Authorization": f"Bearer {expired}"})
    assert resp.status_code == 401
