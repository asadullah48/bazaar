"use client";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { useAuthStore } from "@/store/auth-store";
import { sellerOrdersApi, OrderDetail } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  payment_confirmed: "bg-blue-100 text-blue-700",
  processing:        "bg-blue-100 text-blue-700",
  packed:            "bg-indigo-100 text-indigo-700",
  shipped:           "bg-purple-100 text-purple-700",
  out_for_delivery:  "bg-orange-100 text-orange-700",
  delivered:         "bg-green-100 text-green-700",
  completed:         "bg-green-100 text-green-700",
  cancelled:         "bg-red-100 text-red-700",
};

export default function SellerOrdersPage() {
  const locale = useLocale();
  const { accessToken } = useAuthStore();
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(n);

  useEffect(() => {
    if (!accessToken) return;
    sellerOrdersApi.list(accessToken)
      .then((d) => setOrders(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Orders</h1>
      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="text-center py-16"><p className="text-gray-400">No orders yet.</p></div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-start px-4 py-3 font-semibold text-gray-500">Order</th>
                <th className="text-start px-4 py-3 font-semibold text-gray-500">Date</th>
                <th className="text-start px-4 py-3 font-semibold text-gray-500">Status</th>
                <th className="text-end px-4 py-3 font-semibold text-gray-500">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{o.order_number}</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {o.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end font-bold text-orange-500">{fmt(o.total_amount)}</td>
                  <td className="px-4 py-3 text-end">
                    <Link href={`/${locale}/seller/orders/${o.id}`} className="text-xs text-orange-500 hover:underline font-medium">
                      Manage →
                    </Link>
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
