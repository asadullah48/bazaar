# Checkout Page & Orders List Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Checkout page (cart summary → CoD order submission) and My Orders list, protected by a cookie-based SSR auth middleware.

**Architecture:** The Next.js Edge middleware wraps `next-intl` — it reads a `bazaar-auth` cookie to gate `/checkout`, `/orders`, `/account`; if missing it redirects to login. The auth store gains cookie side-effects in `setTokens`/`clearTokens` so middleware can see the token without touching localStorage (which is client-only). Both pages are `"use client"` components that call the FastAPI backend directly via `fetch`.

**Tech Stack:** Next.js 14 App Router, Zustand persist, next-intl middleware, TypeScript, Tailwind CSS, Lucide icons.

---

## Task 1: Create feature branch

**Files:** N/A (git operation only)

**Step 1: Create and switch to the branch**

```bash
git checkout main && git pull origin main
git checkout -b feat/checkout
```

Expected: `Switched to a new branch 'feat/checkout'`

---

## Task 2: Cookie bridge in auth-store

**Why this must come first:** The middleware runs on the Edge before any React hydration. Zustand's `persist` writes to `localStorage`, which the Edge runtime cannot read. Writing a plain cookie in `setTokens`/`clearTokens` bridges the gap with zero extra packages.

**Files:**
- Modify: `frontend/src/store/auth-store.ts`

**Step 1: Update `setTokens` and `clearTokens`**

Replace the two methods with:

```typescript
setTokens: (access, refresh, role) => {
  set({ accessToken: access, refreshToken: refresh, role });
  // Cookie lets Edge middleware read auth state (localStorage is client-only)
  if (typeof document !== "undefined") {
    document.cookie = `bazaar-auth=${JSON.stringify({ state: { accessToken: access } })}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`;
  }
},
clearTokens: () => {
  set({ accessToken: null, refreshToken: null, role: null });
  if (typeof document !== "undefined") {
    document.cookie = "bazaar-auth=; path=/; max-age=0";
  }
},
```

**Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

**Step 3: Commit**

```bash
git add frontend/src/store/auth-store.ts
git commit -m "feat(auth-store): write bazaar-auth cookie for SSR middleware"
```

---

## Task 3: SSR auth-guard middleware

**Why:** Next.js middleware runs on every matched request at the Edge, before the page renders. We compose our guard around `next-intl`'s middleware rather than replacing it — intl still needs to run to inject locale headers.

**Files:**
- Modify: `frontend/src/middleware.ts`

**Step 1: Replace the file content**

```typescript
import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const PROTECTED = ["/checkout", "/orders", "/account"];

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const pathWithoutLocale = pathname.replace(/^\/(en|ar)/, "");

  if (PROTECTED.some((p) => pathWithoutLocale.startsWith(p))) {
    const raw = req.cookies.get("bazaar-auth")?.value;
    let isAuth = false;
    if (raw) {
      try {
        isAuth = !!JSON.parse(raw)?.state?.accessToken;
      } catch {}
    }
    if (!isAuth) {
      const locale = pathname.split("/")[1] || "en";
      return NextResponse.redirect(
        new URL(`/${locale}/auth/login`, req.url)
      );
    }
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
```

**Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

**Step 3: Commit**

```bash
git add frontend/src/middleware.ts
git commit -m "feat(middleware): cookie-based SSR auth guard for /checkout /orders /account"
```

---

## Task 4: Checkout page

**Files:**
- Create: `frontend/src/app/[locale]/checkout/page.tsx`

**Step 1: Create the page**

```typescript
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useCartStore } from "@/store/cart-store";
import { useAuthStore } from "@/store/auth-store";
import { ApiError } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function CheckoutPage() {
  const t = useTranslations("cart");
  const locale = useLocale();
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCartStore();
  const { accessToken } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) router.push(`/${locale}/auth/login`);
  }, [accessToken, locale, router]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      maximumFractionDigits: 0,
    }).format(n);

  async function placeOrder() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/v1/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            is_b2b: false,
          })),
          payment_method: "cod",
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new ApiError(res.status, body.detail ?? "Checkout failed");
      }
      const data = await res.json();
      clearCart();
      setOrderId(data.orders?.[0]?.id ?? "placed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  if (orderId) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 gap-6">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-3xl">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Order Placed!
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Your order is being processed.
        </p>
        <button
          onClick={() => router.push(`/${locale}/orders`)}
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 px-6 rounded-xl"
        >
          View My Orders
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 gap-4">
        <p className="text-gray-500 dark:text-gray-400">Your cart is empty.</p>
        <button
          onClick={() => router.push(`/${locale}`)}
          className="text-orange-500 hover:underline"
        >
          Continue Shopping
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {t("checkout")}
      </h1>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl divide-y divide-gray-100 dark:divide-gray-800">
        {items.map((item) => (
          <div key={item.product_id} className="flex items-center gap-4 p-4">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800 flex-shrink-0">
              <Image
                src={item.image_url}
                alt={item.name}
                fill
                className="object-cover"
                sizes="56px"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                {item.name}
              </p>
              <p className="text-xs text-gray-400">
                {item.seller_name} · Qty {item.quantity}
              </p>
            </div>
            <p className="text-sm font-semibold text-orange-500">
              {fmt(item.price * item.quantity)}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-3">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Subtotal</span>
          <span>{fmt(totalPrice())}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Shipping</span>
          <span className="text-green-600">Free</span>
        </div>
        <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white border-t border-gray-100 dark:border-gray-800 pt-3">
          <span>Total</span>
          <span className="text-orange-500">{fmt(totalPrice())}</span>
        </div>
        <p className="text-xs text-gray-400 text-center">
          Payment method: Cash on Delivery
        </p>
      </div>

      <button
        onClick={placeOrder}
        disabled={loading}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold py-4 rounded-2xl text-lg transition-colors"
      >
        {loading ? "Placing Order…" : "Place Order"}
      </button>
    </div>
  );
}
```

**Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero new errors.

**Step 3: Commit**

```bash
git add "frontend/src/app/[locale]/checkout/page.tsx"
git commit -m "feat(frontend): checkout page — cart summary, CoD submit, success state"
```

---

## Task 5: Orders list page

**Files:**
- Create: `frontend/src/app/[locale]/orders/page.tsx`

**Step 1: Create the page**

```typescript
"use client";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { Package } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending_payment: "bg-yellow-100 text-yellow-700",
  payment_confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-blue-100 text-blue-700",
  packed: "bg-indigo-100 text-indigo-700",
  shipped: "bg-purple-100 text-purple-700",
  out_for_delivery: "bg-orange-100 text-orange-700",
  delivered: "bg-green-100 text-green-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function OrdersPage() {
  const locale = useLocale();
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      maximumFractionDigits: 0,
    }).format(n);

  useEffect(() => {
    if (!accessToken) {
      router.push(`/${locale}/auth/login`);
      return;
    }
    fetch(`${BASE}/v1/orders`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => setOrders(data.items ?? data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken, locale, router]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <p className="text-gray-400">Loading orders…</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        My Orders
      </h1>
      {orders.length === 0 ? (
        <div className="text-center py-16">
          <Package
            size={48}
            className="mx-auto text-gray-200 dark:text-gray-700 mb-4"
          />
          <p className="text-gray-400">No orders yet.</p>
          <Link
            href={`/${locale}`}
            className="mt-4 inline-block text-orange-500 hover:underline"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex items-center justify-between gap-4"
            >
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {order.order_number}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(order.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    STATUS_COLOR[order.status] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {order.status.replace(/_/g, " ")}
                </span>
                <p className="font-bold text-orange-500">
                  {fmt(order.total_amount)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero new errors.

**Step 3: Commit**

```bash
git add "frontend/src/app/[locale]/orders/page.tsx"
git commit -m "feat(frontend): orders list page with status badges"
```

---

## Task 6: Final verification & PR

**Step 1: Full TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Expected: zero errors.

**Step 2: Push and open PR**

```bash
git push origin feat/checkout
gh pr create \
  --title "feat(frontend): checkout page + orders list + SSR auth middleware" \
  --body "## Summary
- Checkout page: cart summary, CoD payment, POST /v1/checkout, success state
- Orders page: list with status badge, amount, date
- Middleware: cookie-based SSR auth guard for /checkout, /orders, /account
- auth-store: setTokens/clearTokens write bazaar-auth cookie for middleware

## Test plan
- [ ] Unauthenticated /checkout redirects to /auth/login
- [ ] Unauthenticated /orders redirects to /auth/login
- [ ] Checkout flow: items render → Place Order → success screen → View My Orders
- [ ] Orders page shows list after placement
- [ ] tsc --noEmit passes with zero errors"
```
