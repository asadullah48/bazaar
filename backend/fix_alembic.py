import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def fix():
    engine = create_async_engine("postgresql+asyncpg://bazaar:bazaarpass@localhost:5432/bazaar_db")
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM alembic_version"))
        await conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('9d358bc45b6e')"))
        result = await conn.execute(text("SELECT version_num FROM alembic_version"))
        print("alembic_version now:", result.fetchall())

asyncio.run(fix())
