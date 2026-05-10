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

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");

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
            <span
              className={`text-sm ${
                i === step
                  ? "font-semibold text-gray-900 dark:text-white"
                  : "text-gray-400"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <ChevronRight size={14} className="text-gray-300 dark:text-gray-700" />
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="text-red-500 text-sm mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          {error}
        </p>
      )}

      {/* Step 1: Basic Info */}
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title *
            </label>
            <input
              value={title}
              onChange={(e) => autoSlug(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Product title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Slug *
            </label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono"
              placeholder="product-slug"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="">— No category —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Price (PKR) *
              </label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sale Price
              </label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Stock Qty *
              </label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                SKU Code *
              </label>
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
              <span className="text-gray-900 dark:text-white">
                PKR {Number(price).toLocaleString()}
              </span>
            </div>
            {salePrice && (
              <div className="flex justify-between">
                <span className="text-gray-500">Sale Price</span>
                <span className="text-gray-900 dark:text-white">
                  PKR {Number(salePrice).toLocaleString()}
                </span>
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
          <p className="text-xs text-gray-400 pt-1">
            Product will be created as a draft. Publish it from the products list.
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={() =>
            step > 0
              ? setStep(step - 1)
              : router.push(`/${locale}/seller/products`)
          }
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
