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
            <Link
              key={order.id}
              href={`/${locale}/orders/${order.id}`}
              className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex items-center justify-between gap-4 hover:border-orange-200 dark:hover:border-orange-900 transition-colors"
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
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
