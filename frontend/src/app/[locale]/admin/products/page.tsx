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

  useEffect(() => {
    load(tab);
  }, [accessToken, tab]);

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
        <p className="text-sm text-gray-400 mt-0.5">
          {total} {tab.replace("_", " ")}
        </p>
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
        <p className="text-gray-400 text-center py-16">
          No {tab.replace("_", " ")} products.
        </p>
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
                <tr
                  key={p.id}
                  className="border-b border-gray-50 dark:border-gray-800/50 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {p.title}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700 dark:text-gray-300">
                      {p.seller_store_name ?? "—"}
                    </p>
                    <p className="text-xs text-gray-400">{p.seller_email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        STATUS_BADGE[p.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
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
