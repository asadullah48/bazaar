# Seller Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a seller-only dashboard at `/[locale]/seller` where sellers can view their product list, publish/archive products, and create new products via a 3-step form.

**Architecture:** Client-side role guard in layout (middleware only checks accessToken — no role in cookie). All seller API routes live at `/v1/seller/products` (router prefix="/seller", registered at "/v1"). Category tree is fetched from `/v1/categories` and flattened for a select dropdown.

**Tech Stack:** Next.js 14 App Router, "use client" components, Zustand auth-store, Tailwind CSS, lucide-react icons.

---

### Task 1: Add sellerProductsApi + categoriesApi to api.ts

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Verified backend shapes (from backend/app/schemas/product.py + routers/products.py):**
- `GET /v1/seller/products` → `ProductListResponse { items: ProductListItem[], total, page, size }`
- `ProductListItem { id, title, slug, status, category_id, created_at }` — NO price/stock
- `GET /v1/seller/products/{id}` → `ProductResponse { id, title, slug, description, category_id, status, is_b2b_eligible, b2b_moq, attributes, variants: ProductVariant[], images: ProductImage[], created_at }`
- `POST /v1/seller/products` body: `{ title, slug, description, category_id, is_b2b_eligible?, b2b_moq?, attributes?, variants: VariantCreate[] }`
- `VariantCreate { price, stock_qty, sku_code, sale_price?, option1_name?, option1_value?, option2_name?, option2_value?, is_active? }`
- `PUT /v1/seller/products/{id}/publish` → returns `ProductResponse`
- `DELETE /v1/seller/products/{id}` → archives (returns `ProductResponse` with status="archived")
- `GET /v1/categories` → `CategoryNode[]` where `CategoryNode { id, name, slug, icon_url, children: CategoryNode[] }`

**Step 1: Add types and API methods**

Append to `frontend/src/lib/api.ts`:

```typescript
// ── Seller Products ──────────────────────────────────────────────────────────

export interface SellerProductListItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  category_id: string | null;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  sku_code: string;
  price: number;
  sale_price: number | null;
  stock_qty: number;
  is_active: boolean;
  option1_name: string | null;
  option1_value: string | null;
  option2_name: string | null;
  option2_value: string | null;
}

export interface SellerProduct {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  status: string;
  is_b2b_eligible: boolean;
  b2b_moq: number | null;
  attributes: Record<string, unknown>;
  variants: ProductVariant[];
  images: { id: string; url: string; alt: string | null; is_primary: boolean }[];
  created_at: string;
}

export interface VariantCreate {
  price: number;
  stock_qty: number;
  sku_code: string;
  sale_price?: number;
  option1_name?: string;
  option1_value?: string;
  option2_name?: string;
  option2_value?: string;
}

export interface ProductCreate {
  title: string;
  slug: string;
  description?: string;
  category_id?: string;
  is_b2b_eligible?: boolean;
  b2b_moq?: number;
  variants: VariantCreate[];
}

export const sellerProductsApi = {
  list: (token: string, params?: { page?: number; size?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.size) qs.set("size", String(params.size));
    return request<{ items: SellerProductListItem[]; total: number; page: number; size: number }>(
      `/v1/seller/products?${qs}`,
      {},
      token
    );
  },
  get: (token: string, id: string) =>
    request<SellerProduct>(`/v1/seller/products/${id}`, {}, token),
  create: (token: string, data: ProductCreate) =>
    request<SellerProduct>("/v1/seller/products", { method: "POST", body: JSON.stringify(data) }, token),
  publish: (token: string, id: string) =>
    request<SellerProduct>(`/v1/seller/products/${id}/publish`, { method: "PUT" }, token),
  archive: (token: string, id: string) =>
    request<SellerProduct>(`/v1/seller/products/${id}`, { method: "DELETE" }, token),
};

// ── Categories ───────────────────────────────────────────────────────────────

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  children: CategoryNode[];
}

export const categoriesApi = {
  tree: () => request<CategoryNode[]>("/v1/categories"),
};
```

**Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(api): add sellerProductsApi and categoriesApi"
```

---

### Task 2: Add /seller to middleware PROTECTED list

**Files:**
- Modify: `frontend/src/middleware.ts`

**Current PROTECTED array (line 7):**
```typescript
const PROTECTED = ["/checkout", "/orders", "/account"];
```

**Step 1: Add "/seller"**

Change to:
```typescript
const PROTECTED = ["/checkout", "/orders", "/account", "/seller"];
```

**Step 2: Commit**

```bash
git add frontend/src/middleware.ts
git commit -m "feat(auth): protect /seller routes in middleware"
```

---

### Task 3: Seller layout with sidebar + role guard

**Files:**
- Create: `frontend/src/app/[locale]/seller/layout.tsx`

**Step 1: Create the layout**

```tsx
"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import Link from "next/link";
import { LayoutDashboard, Package, ShoppingBag } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { accessToken, role } = useAuthStore();

  useEffect(() => {
    if (!accessToken || role !== "seller") {
      router.replace(`/${locale}/auth/login`);
    }
  }, [accessToken, role, locale, router]);

  if (!accessToken || role !== "seller") return null;

  const nav = [
    { href: `/${locale}/seller`, label: "Dashboard", icon: LayoutDashboard },
    { href: `/${locale}/seller/products`, label: "Products", icon: Package },
    { href: `/${locale}/seller/orders`, label: "Orders", icon: ShoppingBag },
  ];

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-e border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 pt-6">
        <p className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Seller Hub
        </p>
        <nav className="space-y-0.5 px-2">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== `/${locale}/seller` && pathname.startsWith(href));
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

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/app/[locale]/seller/layout.tsx
git commit -m "feat(seller): layout with sidebar nav and role guard"
```

---

### Task 4: Seller dashboard stub page

**Files:**
- Create: `frontend/src/app/[locale]/seller/page.tsx`

**Step 1: Create dashboard page**

```tsx
"use client";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Package, ShoppingBag, PlusCircle } from "lucide-react";

export default function SellerDashboardPage() {
  const locale = useLocale();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
        <Link
          href={`/${locale}/seller/products`}
          className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 hover:border-orange-200 dark:hover:border-orange-800 transition-colors group"
        >
          <Package size={24} className="text-orange-500 mb-3" />
          <p className="font-semibold text-gray-900 dark:text-white">My Products</p>
          <p className="text-xs text-gray-400 mt-1">View and manage your listings</p>
        </Link>
        <Link
          href={`/${locale}/seller/products/new`}
          className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 hover:border-orange-200 dark:hover:border-orange-800 transition-colors group"
        >
          <PlusCircle size={24} className="text-orange-500 mb-3" />
          <p className="font-semibold text-gray-900 dark:text-white">New Product</p>
          <p className="text-xs text-gray-400 mt-1">Create a new product listing</p>
        </Link>
        <Link
          href={`/${locale}/seller/orders`}
          className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 hover:border-orange-200 dark:hover:border-orange-800 transition-colors group"
        >
          <ShoppingBag size={24} className="text-orange-500 mb-3" />
          <p className="font-semibold text-gray-900 dark:text-white">Orders</p>
          <p className="text-xs text-gray-400 mt-1">Track your incoming orders</p>
        </Link>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/app/[locale]/seller/page.tsx
git commit -m "feat(seller): dashboard stub page"
```

---

### Task 5: Products list page

**Files:**
- Create: `frontend/src/app/[locale]/seller/products/page.tsx`

**Step 1: Create products page**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { PlusCircle, Eye, Trash2 } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { sellerProductsApi, SellerProductListItem } from "@/lib/api";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  archived: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

export default function SellerProductsPage() {
  const locale = useLocale();
  const { accessToken } = useAuthStore();
  const [products, setProducts] = useState<SellerProductListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProducts = () => {
    if (!accessToken) return;
    setLoading(true);
    sellerProductsApi
      .list(accessToken)
      .then((data) => {
        setProducts(data.items);
        setTotal(data.total);
      })
      .catch(() => setError("Failed to load products"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProducts(); }, [accessToken]);

  const handlePublish = async (id: string) => {
    if (!accessToken) return;
    try {
      await sellerProductsApi.publish(accessToken, id);
      loadProducts();
    } catch {
      setError("Failed to publish product");
    }
  };

  const handleArchive = async (id: string) => {
    if (!accessToken || !confirm("Archive this product?")) return;
    try {
      await sellerProductsApi.archive(accessToken, id);
      loadProducts();
    } catch {
      setError("Failed to archive product");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Products</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} total</p>
        </div>
        <Link
          href={`/${locale}/seller/products/new`}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors"
        >
          <PlusCircle size={16} />
          New Product
        </Link>
      </div>

      {error && (
        <p className="text-red-500 text-sm mb-4">{error}</p>
      )}

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400">No products yet.</p>
          <Link
            href={`/${locale}/seller/products/new`}
            className="mt-4 inline-block text-orange-500 hover:underline text-sm"
          >
            Create your first product
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Product</th>
                <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Created</th>
                <th className="text-end px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white">{p.title}</p>
                    <p className="text-xs text-gray-400">{p.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {p.status === "draft" && (
                        <button
                          onClick={() => handlePublish(p.id)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 transition-colors font-medium"
                        >
                          <Eye size={12} />
                          Publish
                        </button>
                      )}
                      {p.status !== "archived" && (
                        <button
                          onClick={() => handleArchive(p.id)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors font-medium"
                        >
                          <Trash2 size={12} />
                          Archive
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

**Step 2: Commit**

```bash
git add frontend/src/app/[locale]/seller/products/page.tsx
git commit -m "feat(seller): products list with publish/archive actions"
```

---

### Task 6: New product 3-step form

**Files:**
- Create: `frontend/src/app/[locale]/seller/products/new/page.tsx`

**Step 1: Create the 3-step form**

Step 1 = Basic Info (title, slug, description, category)
Step 2 = First Variant (price, stock, sku_code)
Step 3 = Review + Submit

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ChevronRight, ChevronLeft, Check } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { sellerProductsApi, categoriesApi, CategoryNode } from "@/lib/api";

function flattenCategories(nodes: CategoryNode[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((n) => [
    { id: n.id, label: "  ".repeat(depth) + n.name },
    ...flattenCategories(n.children, depth + 1),
  ]);
}

const STEPS = ["Basic Info", "Variant", "Review"];

export default function NewProductPage() {
  const locale = useLocale();
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Step 1 fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");

  // Step 2 fields
  const [price, setPrice] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [skuCode, setSkuCode] = useState("");
  const [salePrice, setSalePrice] = useState("");

  useEffect(() => {
    categoriesApi.tree().then((nodes) => setCategories(flattenCategories(nodes)));
  }, []);

  const autoSlug = (val: string) => {
    setTitle(val);
    setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  };

  const handleSubmit = async () => {
    if (!accessToken) return;
    setSubmitting(true);
    setError("");
    try {
      await sellerProductsApi.create(accessToken, {
        title,
        slug,
        description: description || undefined,
        category_id: categoryId || undefined,
        variants: [
          {
            price: Number(price),
            stock_qty: Number(stockQty),
            sku_code: skuCode,
            sale_price: salePrice ? Number(salePrice) : undefined,
          },
        ],
      });
      router.push(`/${locale}/seller/products`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create product");
      setStep(0);
    } finally {
      setSubmitting(false);
    }
  };

  const canNext = () => {
    if (step === 0) return title.trim() && slug.trim();
    if (step === 1) return price && Number(price) > 0 && stockQty && skuCode.trim();
    return true;
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">New Product</h1>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                i < step
                  ? "bg-green-500 text-white"
                  : i === step
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-400"
              }`}
            >
              {i < step ? <Check size={12} /> : i + 1}
            </div>
            <span className={`text-sm ${i === step ? "font-semibold text-gray-900 dark:text-white" : "text-gray-400"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <ChevronRight size={14} className="text-gray-300 dark:text-gray-700" />}
          </div>
        ))}
      </div>

      {error && <p className="text-red-500 text-sm mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">{error}</p>}

      {/* Step 1: Basic Info */}
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
            <input
              value={title}
              onChange={(e) => autoSlug(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Product title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug *</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono"
              placeholder="product-slug"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="">— No category —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              placeholder="Optional product description"
            />
          </div>
        </div>
      )}

      {/* Step 2: Variant */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Add the first variant for this product.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (PKR) *</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="0"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sale Price</label>
              <input
                type="number"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                min="0"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stock Qty *</label>
              <input
                type="number"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                min="0"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SKU Code *</label>
              <input
                value={skuCode}
                onChange={(e) => setSkuCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono"
                placeholder="SKU-001"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 2 && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-5 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Title</span>
            <span className="font-medium text-gray-900 dark:text-white">{title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Slug</span>
            <span className="font-mono text-gray-700 dark:text-gray-300">{slug}</span>
          </div>
          {categoryId && (
            <div className="flex justify-between">
              <span className="text-gray-500">Category</span>
              <span className="text-gray-700 dark:text-gray-300">
                {categories.find((c) => c.id === categoryId)?.label ?? categoryId}
              </span>
            </div>
          )}
          <div className="border-t border-gray-200 dark:border-gray-800 pt-3 mt-1">
            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Variant</p>
            <div className="flex justify-between">
              <span className="text-gray-500">Price</span>
              <span className="text-gray-900 dark:text-white">PKR {Number(price).toLocaleString()}</span>
            </div>
            {salePrice && (
              <div className="flex justify-between">
                <span className="text-gray-500">Sale Price</span>
                <span className="text-gray-900 dark:text-white">PKR {Number(salePrice).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Stock</span>
              <span className="text-gray-900 dark:text-white">{stockQty} units</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">SKU</span>
              <span className="font-mono text-gray-700 dark:text-gray-300">{skuCode}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 pt-1">Product will be created as a draft. Publish it from the products list.</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={() => step > 0 ? setStep(step - 1) : router.push(`/${locale}/seller/products`)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ChevronLeft size={16} />
          {step === 0 ? "Cancel" : "Back"}
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canNext()}
            className="flex items-center gap-2 px-5 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Creating…" : "Create Product"}
            {!submitting && <Check size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/app/[locale]/seller/products/new/page.tsx
git commit -m "feat(seller): 3-step new product form"
```

---

### Task 7: Seller orders stub

**Files:**
- Create: `frontend/src/app/[locale]/seller/orders/page.tsx`

**Step 1: Create stub**

```tsx
"use client";
import { ShoppingBag } from "lucide-react";

export default function SellerOrdersPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Orders</h1>
      <div className="text-center py-16">
        <ShoppingBag size={48} className="mx-auto text-gray-200 dark:text-gray-700 mb-4" />
        <p className="text-gray-400">Order management coming soon.</p>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/app/[locale]/seller/orders/page.tsx
git commit -m "feat(seller): orders stub page"
```

---

### Task 8: Type-check + final commit + push + PR

**Step 1: Run type check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors

**Step 2: Push and open PR**

```bash
git push -u origin feat/seller-dashboard
gh pr create --title "feat: seller dashboard — products list, new product form" --body "..."
```
