import uuid
from types import SimpleNamespace

from app.schemas.product import PublicProductVariant
from httpx import ASGITransport, AsyncClient
from sqlalchemy import update, delete
from app.main import app
from app.models.user import SellerProfile
from app.models.review import Review
from tests.conftest import _TestSession
from tests.test_catalog import client, seller_with_profile, _publish, SELLER_PROD


def test_public_variant_excludes_internal_cost():
    variant = SimpleNamespace(id=uuid.uuid4(), sku_code="TEST", price=1250.5,
                              stock_qty=12, is_active=True, cost_price=900,
                              weight_grams=100, product_id=uuid.uuid4())
    result = PublicProductVariant.model_validate(variant).model_dump()
    assert set(result) == {"id", "sku_code", "price", "stock_qty", "is_active"}
    assert result["price"] == 1250.5


def test_public_variant_allows_missing_sku():
    variant = PublicProductVariant(id=uuid.uuid4(), price=1.25, stock_qty=0, is_active=True)
    assert variant.sku_code is None
    assert variant.stock_qty == 0


async def test_product_without_reviews_does_not_inherit_seller_rating(client, seller_with_profile):
    headers = {"Authorization": f"Bearer {seller_with_profile['token']}"}
    product = (await client.post(SELLER_PROD, headers=headers, json={"title": f"Rating isolation {uuid.uuid4().hex}"})).json()
    await _publish(product["id"])
    async with _TestSession() as db:
        await db.execute(update(SellerProfile).where(SellerProfile.user_id == uuid.UUID(seller_with_profile["id"])).values(total_rating=4.5, review_count=5))
        await db.commit()
    response = await client.get(f"/v1/products/{product['slug']}")
    assert response.status_code == 200
    assert response.json()["review_count"] == 0
    assert response.json()["avg_rating"] is None


async def test_product_reviews_exclude_hidden_reviews(client, seller_with_profile):
    headers = {"Authorization": f"Bearer {seller_with_profile['token']}"}
    product = (await client.post(SELLER_PROD, headers=headers, json={"title": f"Visible ratings {uuid.uuid4().hex}", "attributes": {"material": "cotton"}, "description": "Test specification"})).json()
    await _publish(product["id"])
    async with _TestSession() as db:
        db.add_all([Review(product_id=uuid.UUID(product["id"]), rating=4, is_visible=True), Review(product_id=uuid.UUID(product["id"]), rating=1, is_visible=False)])
        await db.commit()
    response = await client.get(f"/v1/products/{product['slug']}")
    async with _TestSession() as db:
        await db.execute(delete(Review).where(Review.product_id == uuid.UUID(product["id"])))
        await db.commit()
    assert response.status_code == 200
    assert response.json()["review_count"] == 1
    assert response.json()["avg_rating"] == 4
    assert response.json()["attributes"] == {"material": "cotton"}
    assert response.json()["description"] == "Test specification"
