# Task 15 — Functional Search Bar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the header search bar to the existing `/v1/search` backend endpoint, navigating to a `/[locale]/search?q=` results page on submit.

**Architecture:** Three pieces — (1) a `searchApi` client in `api.ts` typed to the actual search endpoint shape, (2) a new `SearchResultCard` component for the search-specific item shape, and (3) a server-side `search/page.tsx` that fetches results and renders them. The header input gets `useState`, a form wrapper, and Enter-key navigation. No new backend work needed — `GET /v1/search` already exists.

**Tech Stack:** Next.js 14 App Router (server components + "use client" header), next-intl, Tailwind CSS, TypeScript strict mode. Backend: FastAPI, existing `/v1/search` endpoint.

---

## Shape Audit — read before touching any code

The existing `ProductListResponse` in `api.ts` does NOT match `/v1/search` response shape:

| Field | `/v1/search` returns | `ProductListResponse` expects |
|---|---|---|
| title | `title` | `name` |
| price | `min_price: number or null` | `price: number` |
| pagination | `pages` | `size` |
| images | absent | required |
| seller | `seller_id` (UUID only) | `{id, display_name, slug}` |

Do NOT reuse `ProductListResponse` or `ProductCard` for search results. Define fresh types.

---

## Task 1 — Add `SearchItem` type and `searchApi` to `api.ts`

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Open the file and locate the end (after `productsApi`, around line 127)**

**Step 2: Append to `frontend/src/lib/api.ts`**

```typescript
// Search

export interface SearchItem {
  id: string;
  title: string;
  slug: string;
  brand: string | null;
  condition: string | null;
  category_id: string | null;
  seller_id: string;
  min_price: number | null;
  is_b2b_eligible: boolean;
  created_at: string;
}

export interface SearchListResponse {
  items: SearchItem[];
  total: number;
  page: number;
  pages: number;
}

export const searchApi = {
  search: (q: string, page = 1) =>
    request<SearchListResponse>(
      `/v1/search?q=${encodeURIComponent(q)}&page=${page}&limit=20`
    ),
};
```

**Step 3: Verify TypeScript compiles**

Run: `cd D:\bazaar\frontend && npx tsc --noEmit`
Expected: zero errors

**Step 4: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(api): add SearchItem types and searchApi client"
```

---

## Task 2 — Create `SearchResultCard` component

**Files:**
- Create: `frontend/src/components/product/search-result-card.tsx`

Search results have no images or seller display names, so `ProductCard` cannot be used directly. This is a simpler text-based card.

**Step 1: Create the file with this exact content**

```typescript
import Link from "next/link";
import { SearchItem } from "@/lib/api";

interface SearchResultCardProps {
  item: SearchItem;
  locale: string;
}

export function SearchResultCard({ item, locale }: SearchResultCardProps) {
  return (
    <Link
      href={`/${locale}/products/${item.slug}`}
      className="flex flex-col rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm hover:shadow-md transition-shadow duration-200 gap-2"
    >
      <h3 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 leading-snug">
        {item.title}
      </h3>
      {item.brand && (
        <p className="text-xs text-gray-400 dark:text-gray-500">{item.brand}</p>
      )}
      <div className="mt-auto">
        {item.min_price != null ? (
          <p className="text-base font-bold text-orange-500">
            PKR {item.min_price.toLocaleString()}
          </p>
        ) : (
          <p className="text-xs text-gray-400">Price not listed</p>
        )}
      </div>
    </Link>
  );
}
```

**Step 2: Verify TypeScript**

Run: `cd D:\bazaar\frontend && npx tsc --noEmit`
Expected: zero errors

**Step 3: Commit**

```bash
git add frontend/src/components/product/search-result-card.tsx
git commit -m "feat(components): SearchResultCard for search endpoint item shape"
```

---

## Task 3 — Create `search/page.tsx` server component

**Files:**
- Create: `frontend/src/app/[locale]/search/page.tsx`

This is a server component (no "use client"). Reads `?q=` from `searchParams`, calls the API, renders results or empty state.

**Step 1: Create the file with this exact content**

```typescript
import { getTranslations } from "next-intl/server";
import { SearchResultCard } from "@/components/product/search-result-card";
import { searchApi } from "@/lib/api";

interface SearchPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { locale } = await params;
  const { q = "", page: pageStr = "1" } = await searchParams;
  const t = await getTranslations("common");
  const page = Math.max(1, parseInt(pageStr, 10) || 1);

  if (!q.trim()) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-gray-500 dark:text-gray-400">{t("search")}</p>
      </div>
    );
  }

  let result = { items: [], total: 0, page: 1, pages: 0 } as {
    items: Awaited<ReturnType<typeof searchApi.search>>["items"];
    total: number;
    page: number;
    pages: number;
  };
  try {
    result = await searchApi.search(q, page);
  } catch {
    // network or 4xx: show empty state rather than crash the page
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        {result.total} result{result.total !== 1 ? "s" : ""} for &ldquo;{q}&rdquo;
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        Page {result.page} of {result.pages || 1}
      </p>

      {result.items.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No products found for &ldquo;{q}&rdquo;. Try a different search.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {result.items.map((item) => (
            <SearchResultCard key={item.id} item={item} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify TypeScript**

Run: `cd D:\bazaar\frontend && npx tsc --noEmit`
Expected: zero errors

**Step 3: Commit**

```bash
git add "frontend/src/app/[locale]/search/page.tsx"
git commit -m "feat(pages): /[locale]/search?q= results page with SearchResultCard grid"
```

---

## Task 4 — Wire the header search bar

**Files:**
- Modify: `frontend/src/components/header.tsx`

**Step 1: Check which version of header is on the current branch**

Run: `git log --oneline -3 -- frontend/src/components/header.tsx`

The post-auth header (with useAuthStore) may or may not be present depending on whether feat/seller-storefront has been merged. Read the file before editing.

**Step 2: Add these imports if not already present**

```typescript
import { useState } from "react";
import { useRouter } from "next/navigation";
```

**Step 3: Add state and handler inside the Header function**

```typescript
const router = useRouter();
const [query, setQuery] = useState("");

function handleSearch(e: React.FormEvent) {
  e.preventDefault();
  if (query.trim()) router.push(`/${locale}/search?q=${encodeURIComponent(query.trim())}`);
}
```

**Step 4: Replace the search div with a form**

Find this block (the outer search div):

```tsx
<div className="flex-1 max-w-xl mx-auto">
  <div className="relative">
    <Search ... />
    <input
      type="search"
      placeholder={t("common.search")}
      className="..."
    />
  </div>
</div>
```

Replace it with:

```tsx
<form onSubmit={handleSearch} className="flex-1 max-w-xl mx-auto">
  <div className="relative">
    <Search
      size={16}
      className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400"
    />
    <input
      type="search"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder={t("common.search")}
      className="w-full ps-9 pe-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:text-gray-100 placeholder:text-gray-400"
    />
  </div>
</form>
```

**Step 5: Verify TypeScript**

Run: `cd D:\bazaar\frontend && npx tsc --noEmit`
Expected: zero errors

**Step 6: Manual smoke test**

Start dev server: `cd D:\bazaar\frontend && npm run dev`
Open `http://localhost:3000/en`. Type `cotton` and press Enter.
Expected: navigates to `/en/search?q=cotton`. Page renders heading "X results for cotton" (or empty state).

**Step 7: Commit**

```bash
git add frontend/src/components/header.tsx
git commit -m "feat(header): form wrapper + query state + Enter nav to /search?q="
```

---

## Task 5 — Final TypeScript check + push PR

**Step 1: Run full TypeScript check**

```bash
cd D:\bazaar\frontend
npx tsc --noEmit 2>&1
```

Expected: `0 errors` (no output means success)

**Step 2: Create branch if needed and push**

```bash
cd D:\bazaar
git checkout -b feat/search   # skip if already on this branch
git push origin feat/search
```

**Step 3: Open PR**

Title: `feat(frontend): functional search bar + /[locale]/search?q= results page`

Body bullets:
- `searchApi` client typed to actual `/v1/search` shape (`SearchItem`, `SearchListResponse`)
- `SearchResultCard` component — no images/seller required, shows title + brand + min_price
- Server-side `search/page.tsx` with empty-state handling and result count heading
- Header form wrapper with Enter-key navigation to `/[locale]/search?q=`
- `npx tsc --noEmit` passes with zero errors

---

## Shape Reference (keep visible while implementing)

```
GET /v1/search?q=cotton&page=1&limit=20
Response (SearchListResponse):
  items: SearchItem[]
    .id .title .slug .brand .min_price .seller_id .is_b2b_eligible
  total: number
  page: number
  pages: number   <-- NOT "size"

ProductCard needs Product type (name/price/images/seller) -- NOT compatible with SearchItem
Use SearchResultCard instead
```
