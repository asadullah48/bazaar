# Product Reviews UI + Docker Compose — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add product detail page with reviews display + write-review form, and wire up full-stack Docker Compose so the entire app runs with one command.

**Architecture:** Server-component product detail page fetches product by slug; client-side `ProductReviews` component handles review list + authenticated write form. Docker adds `backend` and `frontend` services to existing postgres/redis compose file.

**Tech Stack:** Next.js 14 App Router, FastAPI, Docker Compose v2, multi-stage Dockerfile (node:20-alpine standalone), python:3.12-slim

---

## Part A — Product Reviews UI

### Task 1: Extend api.ts with reviewsApi

**Files:**
- Modify: `frontend/src/lib/api.ts`

**API facts:**
- List: `GET /v1/products/{product_id}/reviews?page=1&limit=10` → `PaginatedReviews`
- Create: `POST /v1/reviews` body: `{ order_id, product_id, rating, body (min 20), title? }` → `ReviewResponse` (201)
- 403 = not a buyer OR order not completed; 409 = already reviewed for this order+product

```typescript
export interface ReviewResponse {
  id: string;
  order_id: string | null;
  product_id: string | null;
  buyer_id: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  helpful_count: number;
  created_at: string;
}

export interface PaginatedReviews {
  items: ReviewResponse[];
  total: number;
  page: number;
  pages: number;
}

export const reviewsApi = {
  list: (productId: string, page = 1) =>
    request<PaginatedReviews>(`/v1/products/${productId}/reviews?page=${page}&limit=10`),

  create: (token: string, payload: {
    order_id: string;
    product_id: string;
    rating: number;
    body: string;
    title?: string;
  }) =>
    request<ReviewResponse>("/v1/reviews", {
      method: "POST",
      body: JSON.stringify(payload),
    }, token),
};
```

### Task 2: ProductReviews component

**Files:**
- Create: `frontend/src/components/product/product-reviews.tsx`

Client component. Props: `productId: string`. Renders:
- Review list (avg rating, count, paginated items)
- Write-review form (only when authenticated buyer; fields: order_id input, star picker, title, body)
- 403 → "You must have a completed order for this product to review it."
- 409 → "You have already reviewed this product for that order."

### Task 3: Product detail page

**Files:**
- Create: `frontend/src/app/[locale]/products/[slug]/page.tsx`

Server component. Fetches `productsApi.get(slug)` at render time. Renders product images, title, price, seller info, add-to-cart section, then `<ProductReviews productId={product.id} />`.

---

## Part B — Docker Compose Full-Stack

### Task 4: backend/Dockerfile

**Files:**
- Create: `backend/Dockerfile`

Multi-stage not needed for Python. Base: `python:3.12-slim`. Copy requirements.txt, pip install, copy app, expose 8000, CMD uvicorn.

### Task 5: frontend/Dockerfile

**Files:**
- Create: `frontend/Dockerfile`
- Modify: `frontend/next.config.mjs` — add `output: "standalone"`

Three-stage: deps (npm ci), builder (npm run build), runner (node:20-alpine, copy .next/standalone).

### Task 6: Update docker-compose.yml

**Files:**
- Modify: `docker-compose.yml`

Add `backend` (depends on postgres + redis, env from `.env`) and `frontend` (depends on backend, NEXT_PUBLIC_API_URL=http://backend:8000) services.

---
