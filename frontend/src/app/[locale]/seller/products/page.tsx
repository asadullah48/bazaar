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

  useEffect(() => {
    loadProducts();
  }, [accessToken]);

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

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

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
                <tr
                  key={p.id}
                  className="border-b border-gray-50 dark:border-gray-800/50 last:border-0"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white">{p.title}</p>
                    <p className="text-xs text-gray-400">{p.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        STATUS_BADGE[p.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
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
