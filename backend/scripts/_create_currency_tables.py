"""One-off: create currency tables directly on Neon (migration version drift remediation)."""
import asyncio
import sys
sys.path.insert(0, ".")
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import get_settings

STATEMENTS = [
    (
        "CREATE TABLE IF NOT EXISTS currencies ("
        "  code VARCHAR(3) NOT NULL PRIMARY KEY,"
        "  name VARCHAR(50) NOT NULL,"
        "  symbol VARCHAR(5) NOT NULL,"
        "  is_default BOOLEAN NOT NULL DEFAULT false,"
        "  is_active BOOLEAN NOT NULL DEFAULT true,"
        "  exchange_rate_to_pkr FLOAT NOT NULL DEFAULT 1.0,"
        "  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL"
        ")"
    ),
    (
        "CREATE TABLE IF NOT EXISTS price_overrides ("
        "  id UUID NOT NULL PRIMARY KEY,"
        "  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,"
        "  currency_code VARCHAR(3) NOT NULL REFERENCES currencies(code) ON DELETE CASCADE,"
        "  price FLOAT NOT NULL,"
        "  is_active BOOLEAN NOT NULL DEFAULT false,"
        "  CONSTRAINT uq_price_override_product_currency UNIQUE (product_id, currency_code)"
        ")"
    ),
]


async def run():
    s = get_settings()
    engine = create_async_engine(s.database_url)
    async with engine.begin() as conn:
        for stmt in STATEMENTS:
            await conn.execute(text(stmt))
    print("currencies and price_overrides tables created (or already existed).")

if __name__ == "__main__":
    asyncio.run(run())
