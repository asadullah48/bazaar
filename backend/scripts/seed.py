"""
Seed script — creates test data for ShopUnity smoke testing.
Run from backend/:  python scripts/seed.py
Requires postgres running and .env file present.
"""
import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).parent.parent))
os.chdir(Path(__file__).parent.parent)

from dotenv import load_dotenv
load_dotenv(override=False)

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.user import User, UserProfile, SellerProfile
from app.models.catalog import Category, Product, ProductImage, ProductVariant

settings = get_settings()


ADMIN = {
    "email": "admin@shopunity.pk",
    "password": "Admin1234!",
    "role": "admin",
}

SELLERS = [
    {
        "email": "seller1@shopunity.pk",
        "password": "Seller1234!",
        "role": "seller",
        "store_name": "Karachi Textiles",
        "store_slug": "karachi-textiles",
        "city": "Karachi",
        "description": "Premium fabric and embroidery supplier from Karachi.",
    },
    {
        "email": "seller2@shopunity.pk",
        "password": "Seller1234!",
        "role": "seller",
        "store_name": "Lahore Electronics",
        "store_slug": "lahore-electronics",
        "city": "Lahore",
        "description": "Latest gadgets and consumer electronics.",
    },
]

CATEGORIES = [
    {"name": "Textiles", "slug": "textiles"},
    {"name": "Electronics", "slug": "electronics"},
    {"name": "Furniture", "slug": "furniture"},
]

PRODUCTS = [
    {
        "title": "Premium Cotton Fabric 3m",
        "slug": "premium-cotton-fabric-3m",
        "description": "High-quality cotton fabric, ideal for suits and shalwar kameez.",
        "category": "textiles",
        "seller": 0,
        "price": 1500,
        "stock": 50,
        "image": "https://placehold.co/400x400/e8d5b7/7a5c2e?text=Cotton+Fabric",
    },
    {
        "title": "Embroidered Dupatta",
        "slug": "embroidered-dupatta",
        "description": "Hand-embroidered silk dupatta with traditional motifs.",
        "category": "textiles",
        "seller": 0,
        "price": 2500,
        "stock": 30,
        "image": "https://placehold.co/400x400/f5c6cb/8b2252?text=Dupatta",
    },
    {
        "title": "Samsung 65-inch 4K TV",
        "slug": "samsung-65-inch-4k-tv",
        "description": "Crystal clear 4K display with smart TV features.",
        "category": "electronics",
        "seller": 1,
        "price": 120000,
        "stock": 10,
        "image": "https://placehold.co/400x400/d0e8f5/1a4a8a?text=Samsung+TV",
    },
    {
        "title": "Wireless Bluetooth Earbuds",
        "slug": "wireless-bluetooth-earbuds",
        "description": "True wireless earbuds with 24-hour battery life.",
        "category": "electronics",
        "seller": 1,
        "price": 4500,
        "stock": 100,
        "image": "https://placehold.co/400x400/d5f5e3/1e8449?text=Earbuds",
    },
    {
        "title": "Wooden Study Desk",
        "slug": "wooden-study-desk",
        "description": "Solid sheesham wood desk with storage drawer.",
        "category": "furniture",
        "seller": 0,
        "price": 18000,
        "stock": 5,
        "image": "https://placehold.co/400x400/f5e6d0/7a4e1e?text=Study+Desk",
    },
]


async def seed():
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # ── Categories ────────────────────────────────────────────────────────
        cat_map: dict[str, Category] = {}
        for cat_data in CATEGORIES:
            existing = await session.execute(
                select(Category).where(Category.slug == cat_data["slug"])
            )
            cat = existing.scalar_one_or_none()
            if not cat:
                cat = Category(name=cat_data["name"], slug=cat_data["slug"])
                session.add(cat)
                await session.flush()
                print(f"  [+] Category: {cat.name}")
            else:
                print(f"  [=] Category exists: {cat.name}")
            cat_map[cat_data["slug"]] = cat

        # ── Admin user ────────────────────────────────────────────────────────
        existing_admin = await session.execute(
            select(User).where(User.email == ADMIN["email"])
        )
        admin_user = existing_admin.scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                email=ADMIN["email"],
                password_hash=hash_password(ADMIN["password"]),
                role=ADMIN["role"],
                is_active=True,
            )
            session.add(admin_user)
            await session.flush()
            session.add(UserProfile(user_id=admin_user.id, full_name="Admin"))
            print(f"  [+] Admin: {admin_user.email}")
        else:
            print(f"  [=] Admin exists: {admin_user.email}")

        # ── Seller accounts ───────────────────────────────────────────────────
        seller_users: list[User] = []
        for s in SELLERS:
            existing_seller = await session.execute(
                select(User).where(User.email == s["email"])
            )
            seller_user = existing_seller.scalar_one_or_none()
            if not seller_user:
                seller_user = User(
                    email=s["email"],
                    password_hash=hash_password(s["password"]),
                    role=s["role"],
                    is_active=True,
                )
                session.add(seller_user)
                await session.flush()
                session.add(UserProfile(user_id=seller_user.id, full_name=s["store_name"]))
                seller_profile = SellerProfile(
                    user_id=seller_user.id,
                    store_name=s["store_name"],
                    store_slug=s["store_slug"],
                    city=s["city"],
                    description=s["description"],
                    status="approved",
                    approved_at=datetime.now(timezone.utc),
                )
                session.add(seller_profile)
                print(f"  [+] Seller: {seller_user.email} ({s['store_name']})")
            else:
                print(f"  [=] Seller exists: {seller_user.email}")
            seller_users.append(seller_user)

        await session.flush()

        # ── Products ──────────────────────────────────────────────────────────
        for p_data in PRODUCTS:
            existing_product = await session.execute(
                select(Product).where(Product.slug == p_data["slug"])
            )
            product = existing_product.scalar_one_or_none()
            if not product:
                seller = seller_users[p_data["seller"]]
                cat = cat_map[p_data["category"]]
                product = Product(
                    seller_id=seller.id,
                    category_id=cat.id,
                    title=p_data["title"],
                    slug=p_data["slug"],
                    description=p_data["description"],
                    condition="new",
                    status="approved",
                )
                session.add(product)
                await session.flush()

                session.add(ProductImage(
                    product_id=product.id,
                    url=p_data["image"],
                    is_primary=True,
                    sort_order=0,
                ))

                session.add(ProductVariant(
                    product_id=product.id,
                    sku_code=p_data["slug"].upper()[:20],
                    price=p_data["price"],
                    stock_qty=p_data["stock"],
                    is_active=True,
                ))
                print(f"  [+] Product: {p_data['title']} @ PKR {p_data['price']:,}")
            else:
                print(f"  [=] Product exists: {p_data['title']}")

        await session.commit()
        print("\nSeed complete.")


if __name__ == "__main__":
    print("Seeding ShopUnity database...")
    asyncio.run(seed())
