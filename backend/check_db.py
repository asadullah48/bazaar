import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check():
    engine = create_async_engine("postgresql+asyncpg://bazaar:bazaarpass@localhost:5432/bazaar_db")
    async with engine.connect() as conn:
        tables = await conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"))
        print("Tables:", [r[0] for r in tables.fetchall()])
        cols = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position"))
        print("users cols:", [r[0] for r in cols.fetchall()])

asyncio.run(check())
