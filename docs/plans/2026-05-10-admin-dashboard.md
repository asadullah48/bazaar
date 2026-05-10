# Admin Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an admin-only dashboard at `/[locale]/admin` that lets admins approve/suspend sellers, approve/reject products, and mark payouts as paid.

**Architecture:** Client-side role guard (`role !== "admin"` → redirect to `/`) in layout, plus Edge middleware cookie guard for `/admin`. All routes live at `/v1/admin/...` (router prefix="/admin" registered at "/v1"). Overview stats fetched in parallel via 3 limit=1 queries (each returns a `total` field). No single stats endpoint exists.

**Tech Stack:** Next.js 14 App Router, "use client" components, Zustand auth-store, Tailwind CSS, lucide-react icons.

---

## Verified backend shapes (read from source)

### Routes (all confirmed from backend/app/routers/admin.py)
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | /v1/admin/sellers?status=&page=&limit= | — | AdminPaginatedSellers |
| PUT | /v1/admin/sellers/{user_id}/approve | — | AdminSellerItem |
| PUT | /v1/admin/sellers/{user_id}/suspend | — | AdminSellerItem |
| GET | /v1/admin/products?status=&page=&limit= | — | AdminPaginatedProducts |
| PUT | /v1/admin/products/{product_id}/approve | — | AdminProductDetail |
| PUT | /v1/admin/products/{product_id}/reject | { reason: string } | AdminProductDetail |
| GET | /v1/admin/payouts?status=&page=&limit= | — | PaginatedPayouts |
| PUT | /v1/admin/payouts/{payout_id}/mark-paid | { bank_ref: string } | PayoutRecordResponse |

### Corrections vs original spec
- Approve AND reject product are **PUT** (not POST as spec said)
- `AdminSellerItem` has **no city field** — only `{ id, store_name, email, status, created_at }`
- `AdminProductListItem` has `seller_store_name: string|null` and `seller_email` — **no category field**
- Mark payout paid body: `{ bank_ref: string }` (**required**, not optional)
- **No stats endpoint** — overview fetches 3 routes with `limit=1` and reads `total`

### Types

```typescript
// AdminSellerItem
{ id: string; store_name: string; email: string; status: string; created_at: string; }

// AdminPaginatedSellers
{ items: AdminSellerItem[]; total: number; page: number; pages: number; }

// AdminProductListItem
{ id: string; title: string; status: string; seller_id: string;
  seller_store_name: string | null; seller_email: string; created_at: string; }

// AdminProductDetail (approve/reject response)
{ id: string; title: string; status: string; rejection_reason: string | null;
  seller_id: string; created_at: string; }

// AdminPaginatedProducts
{ items: AdminProductListItem[]; total: number; page: number; pages: number; }

// PayoutRecordResponse
{ id: string; seller_id: string; period_start: string; period_end: string;
  gross_amount: number; commission_amount: number; processing_fees: number;
  net_amount: number; status: string; bank_ref: string | null;
  paid_at: string | null; created_at: string; line_items: []; }

// PaginatedPayouts
{ items: PayoutRecordResponse[]; total: number; page: number; pages: number; }
```

---

### Task 1: Add adminApi to api.ts

**Files:**
- Modify: `frontend/src/lib/api.ts`

Append the following to the end of `api.ts`:

```typescript
// ── Admin ────────────────────────────────────────────────────────────────────

export interface AdminSellerItem {
  id: string;
  store_name: string;
  email: string;
  status: string;
  created_at: string;
}

export interface AdminPaginatedSellers {
  items: AdminSellerItem[];
  total: number;
  page: number;
  pages: number;
}

export interface AdminProductListItem {
  id: string;
  title: string;
  status: string;
  seller_id: string;
  seller_store_name: string | null;
  seller_email: string;
  created_at: string;
}

export interface AdminProductDetail {
  id: string;
  title: string;
  status: string;
  rejection_reason: string | null;
  seller_id: string;
  created_at: string;
}

export interface AdminPaginatedProducts {
  items: AdminProductListItem[];
  total: number;
  page: number;
  pages: number;
}

export interface PayoutRecord {
  id: string;
  seller_id: string;
  period_start: string;
  period_end: string;
  gross_amount: number;
  commission_amount: number;
  processing_fees: number;
  net_amount: number;
  status: string;
  bank_ref: string | null;
  paid_at: string | null;
  created_at: string;
  line_items: unknown[];
}

export interface PaginatedPayouts {
  items: PayoutRecord[];
  total: number;
  page: number;
  pages: number;
}

export const adminApi = {
  listSellers: (token: string, params?: { status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    return request<AdminPaginatedSellers>(`/v1/admin/sellers?${qs}`, {}, token);
  },
  approveSeller: (token: string, userId: string) =>
    request<AdminSellerItem>(`/v1/admin/sellers/${userId}/approve`, { method: "PUT" }, token),
  suspendSeller: (token: string, userId: string) =>
    request<AdminSellerItem>(`/v1/admin/sellers/${userId}/suspend`, { method: "PUT" }, token),

  listProducts: (token: string, params?: { status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    return request<AdminPaginatedProducts>(`/v1/admin/products?${qs}`, {}, token);
  },
  approveProduct: (token: string, productId: string) =>
    request<AdminProductDetail>(`/v1/admin/products/${productId}/approve`, { method: "PUT" }, token),
  rejectProduct: (token: string, productId: string, reason: string) =>
    request<AdminProductDetail>(
      `/v1/admin/products/${productId}/reject`,
      { method: "PUT", body: JSON.stringify({ reason }) },
      token
    ),

  listPayouts: (token: string, params?: { status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    return request<PaginatedPayouts>(`/v1/admin/payouts?${qs}`, {}, token);
  },
  markPayoutPaid: (token: string, payoutId: string, bankRef: string) =>
    request<PayoutRecord>(
      `/v1/admin/payouts/${payoutId}/mark-paid`,
      { method: "PUT", body: JSON.stringify({ bank_ref: bankRef }) },
      token
    ),
};
```

**Commit:**
```bash
git add frontend/src/lib/api.ts
git commit -m "feat(api): add adminApi — sellers, products, payouts"
```

---

### Task 2: Add /admin to middleware PROTECTED list

**Files:**
- Modify: `frontend/src/middleware.ts` line 7

Change:
```typescript
const PROTECTED = ["/checkout", "/orders", "/account"];
```
To:
```typescript
const PROTECTED = ["/checkout", "/orders", "/account", "/seller", "/admin"];
```

Note: Adding `/seller` here too since this branches from main (feat/seller-dashboard hasn't merged).

**Commit:**
```bash
git add frontend/src/middleware.ts
git commit -m "feat(auth): protect /seller and /admin routes in middleware"
```

---

### Task 3: Admin layout with sidebar + role guard

**Files:**
- Create: `frontend/src/app/[locale]/admin/layout.tsx`

```tsx
"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import Link from "next/link";
import { LayoutDashboard, Users, Package, Banknote } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { accessToken, role } = useAuthStore();

  useEffect(() => {
    if (!accessToken || role !== "admin") {
      router.replace(`/${locale}`);
    }
  }, [accessToken, role, locale, router]);

  if (!accessToken || role !== "admin") return null;

  const nav = [
    { href: `/${locale}/admin`, label: "Overview", icon: LayoutDashboard },
    { href: `/${locale}/admin/sellers`, label: "Sellers", icon: Users },
    { href: `/${locale}/admin/products`, label: "Products", icon: Package },
    { href: `/${locale}/admin/payouts`, label: "Payouts", icon: Banknote },
  ];

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="w-56 flex-shrink-0 border-e border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 pt-6">
        <p className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Admin
        </p>
        <nav className="space-y-0.5 px-2">
          {nav.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== `/${locale}/admin` && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
```

**Commit:**
```bash
git add "frontend/src/app/[locale]/admin/layout.tsx"
git commit -m "feat(admin): layout with sidebar nav and role guard"
```

---

### Task 4: Overview page — 3 parallel stat cards

**Files:**
- Create: `frontend/src/app/[locale]/admin/page.tsx`

```tsx
"use client";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { Users, Package, Banknote } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { adminApi } from "@/lib/api";

interface Stats {
  pendingSellers: number;
  pendingProducts: number;
  pendingPayouts: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 hover:border-orange-200 dark:hover:border-orange-800 transition-colors"
    >
      <div className={`inline-flex p-2 rounded-lg mb-3 ${color}`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm text-gray-400 mt-0.5">{label}</p>
    </Link>
  );
}

export default function AdminOverviewPage() {
  const locale = useLocale();
  const { accessToken } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([
      adminApi.listSellers(accessToken, { status: "pending", limit: 1 }),
      adminApi.listProducts(accessToken, { status: "under_review", limit: 1 }),
      adminApi.listPayouts(accessToken, { status: "pending", limit: 1 }),
    ])
      .then(([sellers, products, payouts]) => {
        setStats({
          pendingSellers: sellers.total,
          pendingProducts: products.total,
          pendingPayouts: payouts.total,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Overview</h1>
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
        <StatCard
          label="Pending Sellers"
          value={stats?.pendingSellers ?? 0}
          icon={Users}
          href={`/${locale}/admin/sellers`}
          color="bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400"
        />
        <StatCard
          label="Products Under Review"
          value={stats?.pendingProducts ?? 0}
          icon={Package}
          href={`/${locale}/admin/products`}
          color="bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          label="Pending Payouts"
          value={stats?.pendingPayouts ?? 0}
          icon={Banknote}
          href={`/${locale}/admin/payouts`}
          color="bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400"
        />
      </div>
    </div>
  );
}
```

**Commit:**
```bash
git add "frontend/src/app/[locale]/admin/page.tsx"
git commit -m "feat(admin): overview page with parallel stat cards"
```

---

### Task 5: Sellers management page

**Files:**
- Create: `frontend/src/app/[locale]/admin/sellers/page.tsx`

```tsx
"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { adminApi, AdminSellerItem } from "@/lib/api";

const STATUS_TABS = ["pending", "approved", "suspended"] as const;

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  suspended: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

export default function AdminSellersPage() {
  const { accessToken } = useAuthStore();
  const [tab, setTab] = useState<string>("pending");
  const [sellers, setSellers] = useState<AdminSellerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = (status: string) => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    adminApi
      .listSellers(accessToken, { status })
      .then((data) => {
        setSellers(data.items);
        setTotal(data.total);
      })
      .catch(() => setError("Failed to load sellers"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(tab); }, [accessToken, tab]);

  const handleApprove = async (id: string) => {
    if (!accessToken) return;
    try {
      await adminApi.approveSeller(accessToken, id);
      load(tab);
    } catch {
      setError("Failed to approve seller");
    }
  };

  const handleSuspend = async (id: string) => {
    if (!accessToken || !confirm("Suspend this seller?")) return;
    try {
      await adminApi.suspendSeller(accessToken, id);
      load(tab);
    } catch {
      setError("Failed to suspend seller");
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sellers</h1>
        <p className="text-sm text-gray-400 mt-0.5">{total} {tab}</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800/50 rounded-lg p-1 w-fit">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
              tab === s
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : sellers.length === 0 ? (
        <p className="text-gray-400 text-center py-16">No {tab} sellers.</p>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Store</th>
                <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Email</th>
                <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Joined</th>
                <th className="text-end px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{s.store_name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[s.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {s.status === "pending" && (
                        <button
                          onClick={() => handleApprove(s.id)}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 transition-colors font-medium"
                        >
                          Approve
                        </button>
                      )}
                      {s.status !== "suspended" && (
                        <button
                          onClick={() => handleSuspend(s.id)}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors font-medium"
                        >
                          Suspend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**Commit:**
```bash
git add "frontend/src/app/[locale]/admin/sellers/page.tsx"
git commit -m "feat(admin): sellers table with approve/suspend and status tabs"
```

---

### Task 6: Products management page

**Files:**
- Create: `frontend/src/app/[locale]/admin/products/page.tsx`

```tsx
"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { adminApi, AdminProductListItem } from "@/lib/api";

const STATUS_TABS = ["under_review", "published", "draft"] as const;

const STATUS_BADGE: Record<string, string> = {
  under_review: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  published: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function AdminProductsPage() {
  const { accessToken } = useAuthStore();
  const [tab, setTab] = useState<string>("under_review");
  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = (status: string) => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    adminApi
      .listProducts(accessToken, { status })
      .then((data) => {
        setProducts(data.items);
        setTotal(data.total);
      })
      .catch(() => setError("Failed to load products"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(tab); }, [accessToken, tab]);

  const handleApprove = async (id: string) => {
    if (!accessToken) return;
    try {
      await adminApi.approveProduct(accessToken, id);
      load(tab);
    } catch {
      setError("Failed to approve product");
    }
  };

  const handleReject = async (id: string) => {
    if (!accessToken) return;
    const reason = window.prompt("Rejection reason (required):");
    if (!reason?.trim()) return;
    try {
      await adminApi.rejectProduct(accessToken, id, reason.trim());
      load(tab);
    } catch {
      setError("Failed to reject product");
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Products</h1>
        <p className="text-sm text-gray-400 mt-0.5">{total} {tab.replace("_", " ")}</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800/50 rounded-lg p-1 w-fit">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === s
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : products.length === 0 ? (
        <p className="text-gray-400 text-center py-16">No {tab.replace("_", " ")} products.</p>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Product</th>
                <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Seller</th>
                <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Submitted</th>
                <th className="text-end px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{p.title}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700 dark:text-gray-300">{p.seller_store_name ?? "—"}</p>
                    <p className="text-xs text-gray-400">{p.seller_email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {p.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {p.status === "under_review" && (
                        <>
                          <button
                            onClick={() => handleApprove(p.id)}
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 transition-colors font-medium"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(p.id)}
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors font-medium"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**Commit:**
```bash
git add "frontend/src/app/[locale]/admin/products/page.tsx"
git commit -m "feat(admin): products table with approve/reject and status tabs"
```

---

### Task 7: Payouts management page

**Files:**
- Create: `frontend/src/app/[locale]/admin/payouts/page.tsx`

```tsx
"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { adminApi, PayoutRecord } from "@/lib/api";

const STATUS_TABS = ["pending", "paid"] as const;

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(n);

export default function AdminPayoutsPage() {
  const { accessToken } = useAuthStore();
  const [tab, setTab] = useState<string>("pending");
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = (status: string) => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    adminApi
      .listPayouts(accessToken, { status })
      .then((data) => {
        setPayouts(data.items);
        setTotal(data.total);
      })
      .catch(() => setError("Failed to load payouts"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(tab); }, [accessToken, tab]);

  const handleMarkPaid = async (id: string) => {
    if (!accessToken) return;
    const bankRef = window.prompt("Bank reference number (required):");
    if (!bankRef?.trim()) return;
    try {
      await adminApi.markPayoutPaid(accessToken, id, bankRef.trim());
      load(tab);
    } catch {
      setError("Failed to mark payout as paid");
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payouts</h1>
        <p className="text-sm text-gray-400 mt-0.5">{total} {tab}</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800/50 rounded-lg p-1 w-fit">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
              tab === s
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : payouts.length === 0 ? (
        <p className="text-gray-400 text-center py-16">No {tab} payouts.</p>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Seller</th>
                <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Period</th>
                <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Net Amount</th>
                <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                <th className="text-end px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {p.seller_id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {p.period_start} → {p.period_end}
                  </td>
                  <td className="px-4 py-3 font-bold text-orange-500">
                    {fmt(p.net_amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      {p.status === "pending" && (
                        <button
                          onClick={() => handleMarkPaid(p.id)}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 transition-colors font-medium"
                        >
                          Mark Paid
                        </button>
                      )}
                      {p.status === "paid" && p.bank_ref && (
                        <span className="text-xs font-mono text-gray-400">{p.bank_ref}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**Commit:**
```bash
git add "frontend/src/app/[locale]/admin/payouts/page.tsx"
git commit -m "feat(admin): payouts table with mark-as-paid and status tabs"
```

---

### Task 8: Type-check + push + PR

**Step 1: Run tsc**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors.

**Step 2: Push and open PR**

```bash
git push -u origin feat/admin-dashboard
gh pr create \
  --title "feat: admin dashboard — seller/product approval, payouts" \
  --body "..."
```
