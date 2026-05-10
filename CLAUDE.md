# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ShopUnity is a Pakistan-focused dual-mode B2C/B2B marketplace. The monorepo currently contains a FastAPI backend; a Next.js 14 frontend is planned but not yet scaffolded.

## Commands

### Infrastructure
```bash
docker compose up -d postgres redis       # start PostgreSQL 16 + Redis 7
docker compose up -d                      # also starts pgAdmin at http://localhost:5050
```

### Backend (run from `backend/`)
```bash
# Activate venv (Windows)
source .venv/Scripts/activate

# Run dev server
uvicorn app.main:app --reload --port 8000

# Migrations
alembic upgrade head
alembic revision --autogenerate -m "description"

# Tests (requires local Postgres running)
pytest
pytest tests/test_auth.py           # single file
pytest tests/test_auth.py::test_fn  # single test
pytest --cov=app                    # with coverage
```

## Architecture

### Backend layout
```
backend/
  app/
    core/         # config, database engine, redis client, security helpers, FastAPI deps
    models/       # SQLAlchemy ORM models (one file per domain)
    routers/      # FastAPI routers (one file per domain, registered at /v1/*)
    schemas/      # Pydantic v2 request/response models
  alembic/        # migrations; env.py imports all models via app.models
  tests/          # pytest-asyncio tests using the real local database
```

### Key patterns

**Settings** — `app/core/config.py` uses `pydantic-settings` with `lru_cache`. Access via `get_settings()` everywhere; never import `Settings` directly.

**Database** — All ORM operations are async (`AsyncSession`, `asyncpg`). Session is injected via `Depends(get_db)`. The `Base` class lives in `app/core/database.py`; all models inherit from it.

**Auth flow** — Short-lived JWT access tokens (15 min) + long-lived refresh tokens (7 days). Refresh tokens are SHA-256 hashed before storage in `refresh_tokens` table (rotation on each use). Dependency chain in `app/core/deps.py`: `get_current_user` → `get_current_active_user` → `require_seller / require_admin / require_buyer`.

**User roles** — `consumer`, `business_buyer`, `seller`, `admin`. Stored as a plain string column on `users`.

**Dual B2C/B2B mode** — Products carry `is_b2b_eligible` + `b2b_moq`. Wholesale pricing is in `product_b2b_tiers` (qty-range → price). Cart items and orders track `is_b2b` to select the correct pricing path.

**Domain models**
- `models/user.py` — `User`, `UserProfile`, `SellerProfile`, `Address`, `RefreshToken`
- `models/catalog.py` — `Category` (self-referential tree), `Product`, `ProductImage`, `ProductVariant`, `ProductB2BTier`, `CartItem`, `Wishlist`, `ShippingZone`
- `models/order.py` — `CheckoutSession`, `Order`, `OrderLineItem`, `OrderStatusHistory`, `OrderDocument`
- `models/rfq.py` — `RFQ`, `RFQQuote` (B2B request-for-quote flow)
- `models/review.py`, `models/payout.py`, `models/notification.py` — supporting domains

**All primary keys are UUID** (`postgresql.UUID(as_uuid=True)`). JSONB is used for flexible attributes (`product.attributes`, `order.delivery_address`, `category.attribute_schema`).

### Testing
Tests hit the real local Postgres (`bazaar:bazaarpass@localhost:5432/bazaar_db`) — no mocking. `conftest.py` overrides `get_db` with a `NullPool` engine pointing at the same dev database. Run `docker compose up -d postgres` before testing.

### External services (configured via `.env`)
- **Cloudflare R2** — media storage (boto3 compatible)
- **Twilio WhatsApp** — OTP and order notifications
- **Resend** — transactional email
- **Paymob** — JazzCash/Easypaisa payments
- **Stripe** — card payments
- **arq** — async job queue backed by Redis (separate DB index 1)
