"""Seed PKR, USD, AED into the currencies table."""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.core.config import get_settings
from app.models.catalog import Currency

CURRENCIES = [
    {"code": "PKR", "name": "Pakistani Rupee", "symbol": "₨", "is_default": True, "exchange_rate_to_pkr": 1.0},
    {"code": "USD", "name": "US Dollar", "symbol": "$", "is_default": False, "exchange_rate_to_pkr": 278.5},
    {"code": "AED", "name": "UAE Dirham", "symbol": "د.إ", "is_default": False, "exchange_rate_to_pkr": 75.8},
]


async def seed():
    settings = get_settings()
    engine = create_async_engine(settings.database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        for c in CURRENCIES:
            stmt = pg_insert(Currency).values(**c).on_conflict_do_update(
                index_elements=["code"], set_=c
            )
            await session.execute(stmt)
        await session.commit()
    print("Seeded 3 currencies.")


if __name__ == "__main__":
    asyncio.run(seed())
