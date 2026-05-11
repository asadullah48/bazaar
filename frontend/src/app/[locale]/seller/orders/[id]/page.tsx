"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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

const NEXT_STATUS: Record<string, string> = {
  payment_confirmed: "Mark Processing",
  processing:        "Mark Packed",
  packed:            "Mark Shipped",
  shipped:           "Mark Out for Delivery",
  out_for_delivery:  "Mark Delivered",
  delivered:         "Mark Completed",
};

export default function SellerOrderDetailPage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const { accessToken } = useAuthStore();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [tracking, setTracking] = useState("");
  const [error, setError] = useState("");
  const id = params.id as string;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(n);

  useEffect(() => {
    if (!accessToken) { router.replace(`/${locale}/auth/login`); return; }
    sellerOrdersApi.get(accessToken, id)
      .then(setOrder)
      .catch(() => setError("Order not found"))
      .finally(() => setLoading(false));
  }, [accessToken, id, locale, router]);

  async function advance() {
    if (!accessToken || !order) return;
    setAdvancing(true);
    try {
      setOrder(await sellerOrdersApi.advance(accessToken, order.id, { tracking_number: tracking || undefined }));
      setTracking("");
    } catch { setError("Failed to advance order"); }
    finally { setAdvancing(false); }
  }

  if (loading) return <div className="p-6 text-gray-400">Loading…</div>;
  if (!order) return (
    <div className="p-6 text-center">
      <p className="text-gray-400">{error || "Order not found"}</p>
      <Link href={`/${locale}/seller/orders`} className="text-orange-500 hover:underline mt-4 block">Back to Orders</Link>
    </div>
  );

  const canAdvance = NEXT_STATUS[order.status] !== undefined;
  const needsTracking = order.status === "packed";
  const addr = order.delivery_address as Record<string, string>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/seller/orders`} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft size={18} className="text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{order.order_number}</h1>
          <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString()}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[order.status] ?? "bg-gray-100 text-gray-600"}`}>
          {order.status.replace(/_/g, " ")}
        </span>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
        {order.items.map((item, i) => {
          const snap = item.product_snapshot as Record<string, string>;
          return (
            <div key={i} className="flex justify-between gap-4 px-5 py-4 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{snap.title ?? "Product"}</p>
                {snap.sku_code && <p className="text-xs text-gray-400">SKU: {snap.sku_code}</p>}
                <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
              </div>
              <p className="text-sm font-semibold text-orange-500 shrink-0">{fmt(item.line_total)}</p>
            </div>
          );
        })}
        <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 flex justify-between font-bold text-gray-900 dark:text-white">
          <span>Total</span><span className="text-orange-500">{fmt(order.total_amount)}</span>
        </div>
      </div>

      {addr && Object.keys(addr).length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ship To</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">{addr.full_name} · {addr.phone}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{addr.address_line1}{addr.city ? `, ${addr.city}` : ""}</p>
        </div>
      )}

      {canAdvance && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Update Status</h2>
          {needsTracking && (
            <input value={tracking} onChange={(e) => setTracking(e.target.value)}
              placeholder="Tracking number (optional)"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900 dark:text-white" />
          )}
          <button onClick={advance} disabled={advancing}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
            {advancing ? "Updating…" : NEXT_STATUS[order.status]}
          </button>
        </div>
      )}
    </div>
  );
}
