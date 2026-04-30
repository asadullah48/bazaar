import pytest
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.database import get_db
from app.main import app

# Always target the local dev DB, ignoring any system-level DATABASE_URL override
_LOCAL_DB_URL = "postgresql+asyncpg://bazaar:bazaarpass@localhost:5432/bazaar_db"

_test_engine = create_async_engine(_LOCAL_DB_URL, poolclass=NullPool)
_TestSession = async_sessionmaker(_test_engine, expire_on_commit=False)


async def override_get_db():
    async with _TestSession() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db
