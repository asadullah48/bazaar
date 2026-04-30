import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.core.security import hash_password
from app.main import app
from app.models.catalog import Category
from app.models.user import User, UserProfile
from tests.conftest import _TestSession

CAT_BASE = "/v1/categories"
ADM_BASE = "/v1/admin/categories"
AUTH_BASE = "/v1/auth"


def _slug(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:6]}"


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def seeded_categories():
    parent_slug = _slug("electronics")
    child1_slug = _slug("phones")
    child2_slug = _slug("laptops")
    slugs = [parent_slug, child1_slug, child2_slug]

    async with _TestSession() as db:
        parent = Category(
            id=uuid.uuid4(),
            name="Electronics",
            slug=parent_slug,
            commission_rate=5.0,
            sort_order=1,
            is_active=True,
        )
        db.add(parent)
        await db.flush()
        db.add_all([
            Category(id=uuid.uuid4(), name="Phones", slug=child1_slug,
                     parent_id=parent.id, commission_rate=5.0, is_active=True),
            Category(id=uuid.uuid4(), name="Laptops", slug=child2_slug,
                     parent_id=parent.id, commission_rate=5.0, is_active=True),
        ])
        await db.commit()

    yield {"parent_slug": parent_slug, "child1_slug": child1_slug}

    async with _TestSession() as db:
        await db.execute(delete(Category).where(Category.slug.in_(slugs)))
        await db.commit()


@pytest.fixture
async def admin_token(client: AsyncClient):
    email = f"admin_{uuid.uuid4().hex[:6]}@test.dev"
    password = "Admin123!"

    async with _TestSession() as db:
        user = User(email=email, password_hash=hash_password(password), role="admin")
        db.add(user)
        await db.flush()
        db.add(UserProfile(user_id=user.id))
        await db.commit()

    resp = await client.post(f"{AUTH_BASE}/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    yield token

    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


@pytest.fixture
async def consumer_token(client: AsyncClient):
    email = f"consumer_{uuid.uuid4().hex[:6]}@test.dev"
    password = "Test123!"
    await client.post(f"{AUTH_BASE}/register",
                      json={"email": email, "password": password, "role": "consumer"})
    resp = await client.post(f"{AUTH_BASE}/login", json={"email": email, "password": password})
    token = resp.json()["access_token"]

    yield token

    async with _TestSession() as db:
        await db.execute(delete(User).where(User.email == email))
        await db.commit()


async def test_categories_tree(seeded_categories, client: AsyncClient):
    resp = await client.get(CAT_BASE)
    assert resp.status_code == 200
    tree = resp.json()
    parent = next((c for c in tree if c["slug"] == seeded_categories["parent_slug"]), None)
    assert parent is not None, "parent category not found in tree"
    assert "children" in parent
    assert len(parent["children"]) == 2


async def test_category_detail(seeded_categories, client: AsyncClient):
    resp = await client.get(f"{CAT_BASE}/{seeded_categories['parent_slug']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["slug"] == seeded_categories["parent_slug"]
    assert len(data["children"]) == 2


async def test_create_category_no_admin(consumer_token, client: AsyncClient):
    resp = await client.post(
        ADM_BASE,
        json={"name": "Clothing"},
        headers={"Authorization": f"Bearer {consumer_token}"},
    )
    assert resp.status_code == 403


async def test_create_category_with_admin(admin_token, client: AsyncClient):
    slug = _slug("clothing")
    resp = await client.post(
        ADM_BASE,
        json={"name": "Clothing", "slug": slug, "commission_rate": 8.0},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["slug"] == slug

    async with _TestSession() as db:
        await db.execute(delete(Category).where(Category.slug == slug))
        await db.commit()


async def test_categories_includes_new_category(admin_token, client: AsyncClient):
    slug = _slug("new-cat")
    create = await client.post(
        ADM_BASE,
        json={"name": "New Category", "slug": slug, "commission_rate": 6.0},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create.status_code == 201

    resp = await client.get(CAT_BASE)
    assert resp.status_code == 200
    slugs = [c["slug"] for c in resp.json()]
    assert slug in slugs

    async with _TestSession() as db:
        await db.execute(delete(Category).where(Category.slug == slug))
        await db.commit()
