# Bazaar — Dual-Mode B2C/B2B Marketplace

Pakistan-focused multi-category e-commerce marketplace supporting both B2C consumer shopping and B2B wholesale flows.

## Stack

- **Frontend:** Next.js 14 App Router + Tailwind CSS + shadcn/ui + Zustand
- **Backend:** FastAPI + SQLAlchemy (async) + Pydantic v2
- **Database:** PostgreSQL 16 + Redis 7
- **Storage:** Cloudflare R2
- **Notifications:** Twilio WhatsApp + Resend Email
- **Payments:** Paymob (JazzCash/Easypaisa) + Stripe

## Quick Start

```bash
# Start infrastructure
docker compose up -d postgres redis

# Backend
cd backend
python -m venv .venv && source .venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

## Docs

- API: http://localhost:8000/docs
- pgAdmin: http://localhost:5050
