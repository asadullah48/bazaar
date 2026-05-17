# ShopUnity — Pakistan's Dual-Mode B2B/B2C Marketplace

> Textiles, electronics, furniture, toys and more — wholesale and retail in one platform.

ShopUnity is a full-stack marketplace built for the Pakistani market. Buyers can shop retail or request wholesale quotes; sellers list products and manage orders; admins approve sellers and products before they go live. The platform operates in English, Arabic, and Urdu (both RTL) with PKR pricing throughout.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, Zustand, next-intl (EN/AR/UR — RTL support) |
| **Backend** | FastAPI, Python 3.12, Pydantic v2, async SQLAlchemy (asyncpg) |
| **Database** | PostgreSQL 16 |
| **Cache / Queue** | Redis 7, arq (async job queue) |
| **Auth** | JWT (15 min access + 7 day refresh, rotation on use) |
| **Storage** | Cloudflare R2 (S3-compatible) |
| **Payments** | Paymob (JazzCash/Easypaisa), Stripe (cards) |
| **Notifications** | Twilio WhatsApp, Resend (email) |
| **Infrastructure** | Docker Compose, multi-stage Dockerfile (standalone Next.js) |

---

## Features

| Buyer | Seller | Admin |
|-------|--------|-------|
| Browse products (EN/AR/UR) | Product listing with images | Approve / suspend sellers |
| Search & filter by category, price | 3-step new product form | Approve / reject products |
| Product detail page with reviews | Publish / archive products | Manage payouts |
| Add to cart, cart sidebar | Seller order management | Overview stats dashboard |
| Checkout with address | Seller dashboard | Role-based access guard |
| Order history & status tracking | Earnings overview | |
| Write product reviews (star rating) | | |
| Wishlist | | |
| B2B wholesale: RFQ flow | | |
| Account & address management | | |

---

## Quick Start

**Prerequisites:** Docker Desktop, Git

```bash
git clone https://github.com/asadullah48/bazaar.git
cd bazaar

# Copy env template and fill in secrets
cp backend/.env.example backend/.env

# Start everything: postgres, redis, backend, frontend, pgadmin
docker compose up -d

# Run migrations (first time only)
docker compose exec backend alembic upgrade head
```

Open in browser:

| Service | URL |
|---------|-----|
| Storefront | http://localhost:3000/en |
| API docs | http://localhost:8000/docs |
| pgAdmin | http://localhost:5050 |

---

## Development Setup

### Backend

```bash
cd backend

# Create and activate venv (Windows)
python -m venv .venv
source .venv/Scripts/activate   # PowerShell: .venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start PostgreSQL + Redis
docker compose up -d postgres redis

# Run migrations
alembic upgrade head

# Start dev server (hot reload)
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

npm install

# Set backend URL
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

npm run dev   # http://localhost:3000
```

---

## Running Tests

Tests hit the real local PostgreSQL — no mocks.

```bash
cd backend
source .venv/Scripts/activate
docker compose up -d postgres

alembic upgrade head
pytest                        # all tests
pytest tests/test_auth.py     # single file
pytest --cov=app              # with coverage report
```

Expected: **78 passed** across 17 test files covering auth, catalog, cart, checkout, orders, reviews, search, wishlist, admin, RFQ, payouts, users, addresses, and categories.

---

## API Documentation

FastAPI generates interactive docs automatically:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

All endpoints are versioned under `/v1/`. Public endpoints (product listing, search, reviews) require no authentication. Buyer, seller, and admin endpoints require a JWT Bearer token obtained from `POST /v1/auth/login`.

---

## Architecture

**Headless:** The Next.js frontend consumes the FastAPI backend via REST. No server-side sessions — auth state lives in Zustand (localStorage) with a cookie bridge for Edge middleware route protection.

**Auth:** Short-lived JWT access tokens (15 min) + long-lived refresh tokens (7 days, SHA-256 hashed before storage). Tokens rotate on each refresh. Role hierarchy: `consumer` → `business_buyer` → `seller` → `admin`.

**Dual B2C/B2B:** Products carry `is_b2b_eligible` and `b2b_moq`. Wholesale pricing uses a quantity-range tier table (`product_b2b_tiers`). Cart items and orders record `is_b2b` to select the correct pricing path. B2B buyers can submit RFQs for custom quotes.

**Async SQLAlchemy:** All ORM operations use `AsyncSession` + `asyncpg`. Session injected via `Depends(get_db)`. All primary keys are UUIDs.

**i18n:** `next-intl` handles locale routing (`/en/`, `/ar/`, `/ur/`), RTL layout for Arabic and Urdu, and translation strings. Edge middleware applies locale detection before auth checks.

---

## Environment Variables

Create `backend/.env` (copy from `backend/.env.example`):

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | `postgresql+asyncpg://user:pass@host/db` |
| `REDIS_URL` | Yes | `redis://localhost:6379/0` |
| `JWT_SECRET_KEY` | Yes | Long random string (32+ chars) |
| `JWT_ALGORITHM` | No | Default: `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Default: `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | Default: `7` |
| `R2_ENDPOINT_URL` | For uploads | Cloudflare R2 endpoint |
| `R2_ACCESS_KEY` | For uploads | R2 access key ID |
| `R2_SECRET_KEY` | For uploads | R2 secret access key |
| `R2_BUCKET_NAME` | For uploads | Default: `bazaar-assets` |
| `R2_PUBLIC_URL` | For uploads | Public CDN URL |
| `TWILIO_ACCOUNT_SID` | For WhatsApp | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | For WhatsApp | Twilio auth token |
| `RESEND_API_KEY` | For email | Resend API key |
| `PAYMOB_API_KEY` | For payments | Paymob API key |
| `STRIPE_SECRET_KEY` | For payments | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | For payments | Stripe webhook signing secret |
| `ARQ_REDIS_URL` | For workers | Default: `redis://localhost:6379/1` |
| `FRONTEND_URL` | CORS | Default: `http://localhost:3000` |

Frontend — create `frontend/.env.local`:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend base URL (default: `http://localhost:8000`) |

---

## Contributing

1. Fork and create a branch from `main`
2. Branch naming conventions:
   - `feat/short-description` — new features
   - `fix/short-description` — bug fixes
   - `docs/short-description` — documentation only
3. Ensure `pytest` passes and `npx tsc --noEmit` returns 0 errors before opening a PR
4. Keep PRs focused — one concern per PR
5. Open the PR targeting `main`

---

## License

MIT
