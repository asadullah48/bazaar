# Phase 3: Storefront Experience

**Date:** 2026-05-12  
**Branch:** main  
**Goal:** Homepage slot architecture, flash sales/campaigns, user_events tracking, editorial recommendations, embla-carousel hero upgrade

---

## Context

Phase 2 delivered i18n (en/ar/ur), JSON-LD structured data, DeepL translate endpoint, multi-currency DB models, and `formatPrice` utility. Phase 3 focuses on the buyer-facing storefront experience: dynamic homepage slots driven by campaigns, event tracking for personalisation, and an upgraded hero carousel.

---

## Tasks

### Task 1 — Campaign + UserEvent DB models
**File:** `backend/app/models/campaign.py` (new)

Create 4 models:
- `Campaign` — id (UUID PK), title (str), slug (str unique), type (enum: "flash_sale"|"editorial"|"brand_promo"), start_at/end_at (DateTime), is_active (bool default False), banner_url (str nullable), discount_pct (Float nullable), created_at
- `CampaignProduct` — id (UUID PK), campaign_id FK→Campaign, product_id FK→Product, position (int default 0), override_price (Float nullable)
- `UserEvent` — id (UUID PK), user_id (UUID nullable, no FK), session_id (str), event_type (str: "view"|"click"|"add_to_cart"|"purchase"), product_id FK→Product nullable, campaign_id FK→Campaign nullable, created_at (server default now())
- `SlotEvent` — id (UUID PK), slot_name (str), product_id FK→Product, score (Float default 0.0), computed_at (DateTime server default now())

Add `from app.models.campaign import Campaign, CampaignProduct, UserEvent, SlotEvent` to `backend/alembic/env.py` imports.

Run: `alembic revision --autogenerate -m "add campaign and user event tables"` then `alembic upgrade head`.

**Verification:** `alembic current` shows new head; table exists in psql.

---

### Task 2 — Campaign schemas + CRUD endpoints
**File:** `backend/app/schemas/campaign.py` (new)  
**File:** `backend/app/routers/campaign.py` (new)

Schemas:
- `CampaignCreate` — title, slug, type, start_at, end_at, banner_url?, discount_pct?
- `CampaignOut` — all fields + id
- `CampaignProductAdd` — campaign_id, product_id, position, override_price?

Endpoints (all under `/v1/campaigns`):
- `GET /` — list active campaigns (is_active=True, now between start_at/end_at)
- `GET /{slug}` — single campaign with CampaignProducts + Product stubs
- `POST /` — create campaign (admin only)
- `PATCH /{id}/activate` — set is_active=True (admin only)
- `POST /{id}/products` — add product to campaign (admin only)

Register in `backend/app/main.py`.

**Verification:** `GET /v1/campaigns/` returns `[]` with 200.

---

### Task 3 — Homepage slot endpoints (Redis-cached)
**File:** `backend/app/routers/slots.py` (new)

5 named slots served from `/v1/slots/{name}`:
- `hero` — active flash_sale or editorial campaigns ordered by start_at desc, limit 5
- `deals` — products with `compare_price > price` ordered by discount desc, limit 12
- `trending` — top products by SlotEvent.score desc (or fallback: avg_rating desc), limit 12
- `flash` — active flash_sale campaigns with discount_pct > 0, limit 6
- `recs` — placeholder returning empty list (real ML in Phase 4)

Each slot response is Redis-cached at key `slot:{name}` with 5-minute TTL (300s).

Cache invalidated by POST to `/v1/slots/{name}/invalidate` (admin only).

Response shape: `{ "slot": "<name>", "items": [...], "cached": bool }`

Register in `main.py`.

**Verification:** `GET /v1/slots/deals` returns 200 with `items` array.

---

### Task 4 — UserEvent tracking endpoint (fire-and-forget)
**File:** `backend/app/routers/events.py` (new)

`POST /v1/events` — accepts `UserEventCreate` (session_id, event_type, product_id?, campaign_id?) — inserts row, returns `204 No Content` immediately. Auth optional (user_id from token if present, else null).

No Redis cache. Background task via FastAPI `BackgroundTasks` — insert happens after response returns.

Register in `main.py`.

**Verification:** `POST /v1/events` with `{"session_id":"test","event_type":"view"}` returns 204.

---

### Task 5 — Editorial recommendations endpoint
**File:** `backend/app/routers/recommendations.py` (new)

`GET /v1/recommendations` — query param `product_id` (optional UUID).

Logic:
1. If `product_id` given: fetch that product's categories → return up to 8 products in same category, excluding self, ordered by avg_rating desc.
2. If no `product_id`: return top 8 products by review_count desc.
3. Redis cache key `recs:{product_id or "global"}` TTL 600s.

Response: `{ "items": [ProductStub...], "source": "category"|"global" }`

Register in `main.py`.

**Verification:** `GET /v1/recommendations` returns 200 with `items` array.

---

### Task 6 — Embla-carousel hero upgrade
**Files:**
- `frontend/src/components/home/hero-carousel.tsx` (modify)
- Run: `cd frontend && npm install embla-carousel-react`

Replace current static or plain carousel with embla-carousel. Features:
- Auto-play every 4s (stop on hover)
- Loop enabled
- Dot indicators
- Prev/Next arrow buttons
- Accepts `slides: { image: string; title: string; subtitle: string; href: string; cta: string }[]` prop
- Uses `useEmblaCarousel` hook with `{ loop: true }` option
- Tailwind-styled, RTL-aware (check `dir` attribute for arrow flip)

Hardcode 3 placeholder slides for now (Phase 3 Task 7 will wire to campaign API).

**Verification:** Dev server at `localhost:3000` shows sliding hero with working arrows and dots.

---

### Task 7 — Flash deals section on homepage
**File:** `frontend/src/app/[locale]/page.tsx` (modify)
**File:** `frontend/src/components/home/flash-deals.tsx` (new)

`FlashDeals` component:
- Fetches `/v1/slots/flash` at render time (server component) or via SWR (client)
- Shows countdown timer to campaign `end_at`
- Grid of up to 6 product cards with `discount_pct` badge
- "View all" link to `/products?sale=true`

Wire into homepage below hero.

**Verification:** Component renders without error (empty state shows "No active flash deals").

---

### Task 8 — Recommendation strip on product detail page
**File:** `frontend/src/app/[locale]/products/[slug]/page.tsx` (modify)
**File:** `frontend/src/components/product/recommendations.tsx` (new)

`Recommendations` component (server component):
- Fetches `/v1/recommendations?product_id={id}` 
- Renders horizontal scroll strip with ProductCard components
- Title: `t("product.you_may_also_like")`

Add key to `frontend/messages/en.json`, `ar.json`, `ur.json`: `"you_may_also_like"`.

Wire after product description section in product detail page.

**Verification:** Product detail page renders with recommendations strip (or empty gracefully).

---

### Task 9 — `useTrackEvent` frontend hook
**File:** `frontend/src/hooks/use-track-event.ts` (new)

```typescript
export function useTrackEvent() {
  const sessionId = useSessionId(); // from localStorage, generated once
  return function track(event_type: string, product_id?: string, campaign_id?: string) {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, event_type, product_id, campaign_id }),
    }).catch(() => {}); // fire-and-forget
  };
}
```

Helper `useSessionId`: reads `localStorage.getItem("sid")`, generates and stores `crypto.randomUUID()` if absent.

Wire `track("view", product.id)` into product detail page `useEffect`.

**Verification:** Network tab shows `POST /v1/events` with 204 on product page load.

---

### Task 10 — Admin campaign management UI
**File:** `frontend/src/app/[locale]/admin/campaigns/page.tsx` (new)
**File:** `frontend/src/app/[locale]/admin/campaigns/new/page.tsx` (new)

List page: table of campaigns (title, type, start/end, active toggle).  
New campaign form: title, slug (auto-generated from title), type select, date pickers, discount_pct.

Wire "Activate" button to `PATCH /v1/campaigns/{id}/activate`.  
Add "Campaigns" link to admin sidebar.

**Verification:** `/admin/campaigns` renders campaign table (empty state OK).

---

## Verification Checklist (end of Phase 3)

- [ ] `alembic current` shows new campaign migration head
- [ ] `GET /v1/slots/deals` returns 200
- [ ] `POST /v1/events` returns 204
- [ ] `GET /v1/recommendations` returns 200
- [ ] Hero carousel auto-plays and loops on homepage
- [ ] Flash deals section renders on homepage
- [ ] Recommendations strip renders on product detail page
- [ ] `POST /v1/events` fires from product page (Network tab)
- [ ] `/admin/campaigns` renders without error
- [ ] `pytest tests/test_campaign.py` green (write tests as part of Task 2)
