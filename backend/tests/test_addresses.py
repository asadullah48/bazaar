import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.main import app
from app.models.user import User
from tests.conftest import _TestSession

AUTH = "/v1/auth"
ADDRESSES = "/v1/users/me/addresses"


def _email():
    return f"addr_{uuid.uuid4().hex[:8]}@test.dev"


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def user(client):
    email = _email()
    pw = "Pass123!"
    await client.post(f"{AUTH}/register", json={"email": email, "password": pw, "role": "consumer"})
    token = (
        await client.post(f"{AUTH}/login", json={"email": email, "password": pw})
    ).json()["access_token"]
    hdrs = {"Authorization": f"Bearer {token}"}
    yield {"email": email, "headers": hdrs}
    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


_ADDR1 = {
    "full_name": "Ali Khan",
    "phone": "03001111111",
    "address_line1": "1 Main St",
    "city": "Karachi",
    "label": "Home",
    "is_default": False,
}

_ADDR2 = {
    "full_name": "Ali Khan",
    "phone": "03002222222",
    "address_line1": "2 Office Rd",
    "city": "Lahore",
    "label": "Work",
    "is_default": True,
}


async def test_second_address_is_default(client, user):
    hdrs = user["headers"]

    r1 = await client.post(ADDRESSES, json=_ADDR1, headers=hdrs)
    assert r1.status_code == 201, r1.text
    id1 = r1.json()["id"]

    r2 = await client.post(ADDRESSES, json=_ADDR2, headers=hdrs)
    assert r2.status_code == 201, r2.text

    all_addrs = (await client.get(ADDRESSES, headers=hdrs)).json()
    defaults = [a for a in all_addrs if a["is_default"]]
    non_defaults = [a for a in all_addrs if not a["is_default"]]

    assert len(defaults) == 1
    assert defaults[0]["label"] == "Work"
    assert len([a for a in non_defaults if a["id"] == id1]) == 1


async def test_update_address_to_default(client, user):
    hdrs = user["headers"]

    r1 = await client.post(ADDRESSES, json=_ADDR1, headers=hdrs)
    id1 = r1.json()["id"]
    await client.post(ADDRESSES, json=_ADDR2, headers=hdrs)

    # update first to be default
    r = await client.put(f"{ADDRESSES}/{id1}", json={"is_default": True}, headers=hdrs)
    assert r.status_code == 200, r.text
    assert r.json()["is_default"] is True

    all_addrs = (await client.get(ADDRESSES, headers=hdrs)).json()
    defaults = [a for a in all_addrs if a["is_default"]]
    assert len(defaults) == 1
    assert defaults[0]["id"] == id1


async def test_delete_address(client, user):
    hdrs = user["headers"]

    r = await client.post(ADDRESSES, json=_ADDR1, headers=hdrs)
    addr_id = r.json()["id"]

    del_r = await client.delete(f"{ADDRESSES}/{addr_id}", headers=hdrs)
    assert del_r.status_code == 204

    all_addrs = (await client.get(ADDRESSES, headers=hdrs)).json()
    assert not any(a["id"] == addr_id for a in all_addrs)
