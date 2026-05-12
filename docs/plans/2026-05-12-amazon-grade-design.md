# ShopUnity → Amazon-Grade Marketplace: Design Document

**Date:** 2026-05-12
**Status:** Approved
**Priority order:** Seller Operations → Internationalization → Storefront → Automation

---

## Context

ShopUnity is a Pakistan-focused dual-mode B2C/B2B marketplace built on FastAPI + Next.js 14. The existing stack ships: auth, products, cart, orders, payments, search, reviews, wishlist, RFQ, payouts, admin, and seller dashboard — with `next-intl` locale routing (`/en`, `/ar`) already wired.

This document defines the four phases required to reach Amazon-grade depth.

---

## Phase 1 — Seller Operations Depth

### 1A — Inventory Management

**New backend:** `backend/app/routers/inventory.py`

Models:
- `InventoryAlert` — threshold per variant, triggers auto-pause when `stock_qty < threshold`
- `StockMovement` — audit log of every stock change (who, what, when) for dispute resolution

Endpoints:
- `POST /v1/inventory/bulk-import` — CSV upload with preview + validation before commit
- `GET /v1/inventory/export` — full variant-level stock export as CSV
- `PATCH /v1/inventory/{variant_id}` — inline threshold update

Automation: Redis pub/sub on stock change → WhatsApp/email alert to seller via existing Twilio + Resend

**New frontend:** `/seller/inventory`
- Sortable table: variant | SKU | stock | threshold | status
- Inline threshold editing, bulk pause/resume actions
- CSV upload with row-level validation feedback

### 1B — Payouts & Financials

**New models:** `SellerPayout`, `PayoutLineItem`, `SellerFeeRule`

- Automated payout scheduling (weekly/biweekly, configurable per seller)
- Fee breakdown: platform %, Paymob gateway %, shipping subsidy
- Disbursement via existing Paymob API — no new payment vendor

**New frontend:** `/seller/financials`
- Revenue chart (7d / 30d / 90d)
- Pending payout amount + next scheduled date
- Fee breakdown per transaction
- One-click PDF export

### 1C — Analytics

**New frontend:** `/seller/analytics`
- Revenue charts, conversion funnels, product performance heatmaps
- Traffic sources (organic, direct, campaign)
- Exportable reports (CSV/PDF)

### 1D — Listing Tools (Phase 1 foundation, full build in Phase 4)

- SEO score widget on listing form (0–100)
- "Improve with AI" button on description field
- Auto-categorization confidence display

---

## Phase 2 — Internationalization (Amazon Model)

### 2A — Language Expansion

Add `ur` (Urdu) locale to `frontend/src/i18n/routing.ts`:
```ts
locales: ["en", "ar", "ur"]
```

- Create `messages/ur.json` (~500 keys) — machine-translated via DeepL API, seller/admin overrides via translation management UI
- Urdu is RTL (same `dir="rtl"` CSS class as Arabic)
- Priority translation order: nav → product detail → cart → checkout → error messages

**DeepL API:** free tier = 500K chars/month, sufficient for initial key set

### 2B — Dynamic Content Translation

Product descriptions and reviews are seller-generated — translated at runtime:

- `POST /v1/translate` — FastAPI endpoint wrapping DeepL/LibreTranslate
- Cache in Redis: `translate:{lang}:{content_hash}` → 24h TTL
- Frontend: lazy-load translated content client-side, show original while loading
- Translations never stored in main DB — cache only, regenerate on miss

### 2C — Structured SEO Data

JSON-LD schemas injected server-side via Next.js `generateMetadata`:
- `Product` — name, description, image, sku, offers
- `BreadcrumbList` — full category path
- `Organization` — ShopUnity brand entity
- `AggregateRating` — from reviews data

`hreflang` alternate tags in `<head>` for all locale variants of every product URL.

Sitemap: include all locale variants (`/en/products/x`, `/ar/products/x`, `/ur/products/x`).

### 2D — Currency Localization

- PKR default; USD/AED as display-only conversions
- Exchange rates: `frankfurter.app` API (free, no key), cached daily in Redis
- `formatPrice(amount, locale)` frontend utility — single function for all locales
- **Multi-currency checkout foundation:** `currencies` table + `price_overrides` per locale added to DB now; multi-currency checkout unlocked later via feature flag

---

## Phase 3 — Storefront Experience

### 3A — Homepage Slot Architecture

A `HomepageSection` config (stored in Redis, editable by admin) drives rendering:

| slot_id  | type             | source                        | ttl  |
|----------|------------------|-------------------------------|------|
| hero     | carousel         | manual CMS / Campaign model   | 1h   |
| deals    | product_grid     | query: discount > 20%         | 15m  |
| trending | product_grid     | query: top_sold_7d            | 30m  |
| recs     | product_grid     | user.history / cold fallback  | 5m   |
| flash    | countdown_banner | scheduled Campaign            | live |

- Each slot: FastAPI endpoint `GET /v1/homepage/slots/{slot_id}`, cached in Redis
- Frontend fetches all slots in parallel at SSR — no slot failure blocks the page
- Each slot has `priority_score` + `position` for admin A/B testing and future ML auto-promotion

**Analytics hooks:** every slot impression and click → `slot_events` table:
```
slot_id | user_id | event_type | product_id | ts
```
Feeds future slot ranking optimization.

### 3B — Flash Sales & Today's Deals

New models: `Campaign` + `CampaignProduct`
- `Campaign`: `start_at`, `end_at`, `discount_type` (flat/percent), `max_redemptions`
- Countdown timer uses server time (not client) to prevent clock-skew manipulation
- On campaign end: Redis pub/sub triggers price revert + "Sale ended" badge

### 3C — Hybrid Recommendation Engine

**Phase 3 (now) — Rule-based editorial:**
- Top-rated in same category
- Recently viewed (from `user_events` table)
- New arrivals
- Served via PostgreSQL queries, cached in Redis (5min TTL)

**Phase 5 trigger (at 5K+ interactions) — Collaborative filtering:**
- Switch `/v1/recommend` to use **Implicit** library (Python, matrix factorization)
- A/B tested against editorial baseline
- Nightly batch job via `arq` worker

**Critical:** wire `user_events` tracking (view, click, add-to-cart, purchase) from Phase 3 day one — the ML model needs this data. Collecting it costs nothing now; missing it requires a relaunch.

### 3D — Hero Carousel Upgrade

Existing `hero-carousel.tsx` upgraded:
- Slides sourced from `Campaign` model
- Auto-advance with pause-on-hover
- Mobile: swipe gestures via `embla-carousel`
- Each slide deep-links to campaign's product collection

---

## Phase 4 — Automation

**Infrastructure:** all automation runs as `arq` workers (Redis queue already wired). Each automation is an isolated worker — SEO generation failures never block order notifications.

### 4A — SEO Automation

Triggered on `product.created` / `product.updated`:

```
arq job: generate_seo(product_id)
  → Claude API (Haiku): title + meta_description + 5 focus keywords
  → JSON-LD: Product, Offer, AggregateRating schemas
  → hreflang variants for /en, /ar, /ur
  → stored in product.seo_data (JSONB — already exists)
```

- Prompt template version-controlled; backfill job re-runs on all products when prompt changes
- Cost: ~$0.001/product at Haiku pricing — essentially free at startup scale
- **Explainability:** SEO score widget shows per-criterion breakdown: "Title: ✓ | Images: ✗ add 2 more | Description: ✗ too short" — seller sees exactly what to fix

### 4B — Marketing Automation

Built on existing Twilio + Resend + `Campaign` model.

**Buyer segments** (built from `user_events` + order history):
- `category_affinity` — top 3 categories by view/purchase
- `b2b_vs_b2c` — role-based from user profile
- `avg_order_value_tier` — low / mid / high
- `city` — for logistics-relevant campaigns

**Trigger graph:**
```
Campaign scheduled     → WhatsApp blast to opted-in buyers in matching segment
Order delivered        → "Rate your purchase" email (Resend, 48h delay)
Cart abandoned         → WhatsApp reminder (24h, one-time, opt-out respected)
Flash sale T-1h        → Push + email to wishlist owners of that product
```

Each trigger type uses a separate `arq` queue — blasts never block transactional messages.

### 4C — Seller Onboarding Automation

Guided listing wizard with AI quality gates:

1. **Category suggestion** — Claude API call on product title → "Electronics > Cables (91% confidence)" — pre-fills if >85%, asks seller to confirm below threshold
2. **Description AI-assist** — "Improve with AI" button rewrites to SEO-optimized copy, seller can accept/reject/edit
3. **SEO score widget** — live 0–100 score on listing form with per-criterion explanation
4. **Explainability throughout** — every AI decision shows its reasoning and confidence so sellers learn the system

### 4D — Operational Automation

- `stock_qty = 0` → auto-pause listing + WhatsApp alert to seller
- `stock_qty < threshold` → WhatsApp warning to seller
- Order stuck in `processing` > 24h → escalation to seller + admin flag
- Failed payment → retry (3 attempts, exponential backoff) via existing Paymob webhook
- **Daily seller digest email** (Resend, 6 AM PKT):
  - Orders (count, revenue, vs. yesterday)
  - Top-performing product
  - Pending payout amount + next scheduled date
  - Fee breakdown summary
  - Low-stock warnings

---

## Data Models Summary (New)

| Model | Phase | Purpose |
|-------|-------|---------|
| `InventoryAlert` | 1 | Per-variant stock threshold + auto-pause |
| `StockMovement` | 1 | Audit log of stock changes |
| `SellerPayout` | 1 | Payout scheduling + history |
| `PayoutLineItem` | 1 | Per-order fee breakdown |
| `SellerFeeRule` | 1 | Platform fee configuration |
| `currencies` | 2 | Multi-currency foundation |
| `price_overrides` | 2 | Locale-specific pricing |
| `Campaign` | 3 | Flash sales + hero carousel source |
| `CampaignProduct` | 3 | Products in a campaign |
| `user_events` | 3 | Interaction tracking for ML |
| `slot_events` | 3 | Homepage slot analytics |

---

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Translation | DeepL API (free tier) | 500K chars/month free; quality >> Google Translate for Urdu/Arabic |
| Recommendation (now) | PostgreSQL queries + Redis cache | Zero new infrastructure; good enough until 5K+ interactions |
| Recommendation (later) | Implicit library (Python) | Open-source, fast matrix factorization, runs in existing Python env |
| SEO generation | Claude API (Haiku model) | ~$0.001/product; version-controlled prompt; quality production-grade |
| Job queue | arq (already wired) | No new infrastructure; Redis already in stack |
| Exchange rates | frankfurter.app | Free, no API key, reliable |
| Carousel | embla-carousel | Lightweight, touch-native, works with existing React setup |

---

## Implementation Sequence

```
Phase 1: Seller Operations     (Weeks 1–4)
  └── 1A Inventory management
  └── 1B Payouts & financials
  └── 1C Analytics dashboard
  └── 1D Listing tools foundation

Phase 2: Internationalization  (Weeks 5–8)
  └── 2A Urdu locale + RTL
  └── 2B Dynamic translation cache
  └── 2C JSON-LD structured data
  └── 2D Currency foundation

Phase 3: Storefront            (Weeks 9–12)
  └── 3A Slot architecture + admin config
  └── 3B Campaign + Flash sales
  └── 3C user_events tracking + editorial recs
  └── 3D Hero carousel upgrade

Phase 4: Automation            (Weeks 13–20)
  └── 4A SEO arq worker + Claude API
  └── 4B Segmented marketing triggers
  └── 4C Seller onboarding wizard
  └── 4D Operational alerts + daily digest

Phase 5: ML Recommendations    (When 5K+ interactions)
  └── Implicit library CF model
  └── A/B test vs. editorial baseline
  └── Slot auto-ranking by conversion
```
