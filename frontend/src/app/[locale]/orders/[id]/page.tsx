"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useLocale } from "next-intl";
import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { ordersApi, OrderDetail } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  pending_payment:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  payment_confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  processing:        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  packed:            "bg-indigo-100 text-indigo-700",
  shipped:           "bg-purple-100 text-purple-700",
  out_for_delivery:  "bg-orange-100 text-orange-700",
  delivered:         "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  completed:         "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelled:         "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  payment_failed:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const STEPS = ["payment_confirmed", "processing", "packed", "shipped", "out_for_delivery", "delivered"];

export default function OrderDetailPage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const { accessToken } = useAuthStore();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const id = params.id as string;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(n);

  useEffect(() => {
    if (!accessToken) { router.push(`/${locale}/auth/login`); return; }
    ordersApi.get(accessToken, id)
      .then(setOrder)
      .catch(() => setError("Order not found"))
      .finally(() => setLoading(false));
  }, [accessToken, id, locale, router]);

  async function handleCancel() {
    if (!accessToken || !order || !confirm("Cancel this order?")) return;
    setCancelling(true);
    try { setOrder(await ordersApi.cancel(accessToken, order.id)); }
    catch { setError("Could not cancel order"); }
    finally { setCancelling(false); }
  }

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-10 text-gray-400">Loading…</div>;
  if (error || !order) return (
    <div className="max-w-2xl mx-auto px-4 py-10 text-center">
      <p className="text-gray-400 mb-4">{error || "Order not found"}</p>
      <Link href={`/${locale}/orders`} className="text-orange-500 hover:underline">Back to Orders</Link>
    </div>
  );

  const currentStep = STEPS.indexOf(order.status);
  const isCancellable = ["payment_confirmed", "processing", "packed"].includes(order.status);
  const addr = order.delivery_address as Record<string, string>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/orders`} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
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

      {/* Progress tracker */}
      {currentStep >= 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
          <div className="relative flex items-start justify-between">
            <div className="absolute top-3 left-3 right-3 h-0.5 bg-gray-100 dark:bg-gray-800" />
            <div
              className="absolute top-3 left-3 h-0.5 bg-orange-500 transition-all"
              style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
            />
            {STEPS.map((s, i) => (
              <div key={s} className="relative flex flex-col items-center gap-1 flex-1">
                <div className={`w-6 h-6 rounded-full z-10 flex items-center justify-center text-[10px] font-bold border-2 ${
                  i <= currentStep ? "bg-orange-500 border-orange-500 text-white" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-300"
                }`}>
                  {i < currentStep ? "✓" : i + 1}
                </div>
                <span className="text-[9px] text-gray-400 text-center leading-tight hidden sm:block capitalize">
                  {s.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
          {order.tracking_number && (
            <p className="text-xs text-gray-500 mt-4 text-center">
              Tracking: <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">{order.tracking_number}</span>
            </p>
          )}
        </div>
      )}

      {/* Items */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Package size={14} /> Items
          </h2>
        </div>
        {order.items.map((item, i) => {
          const snap = item.product_snapshot as Record<string, string>;
          return (
            <div key={i} className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{snap.title ?? "Product"}</p>
                {snap.sku_code && <p className="text-xs text-gray-400">SKU: {snap.sku_code}</p>}
                {(snap.option1_value || snap.option2_value) && (
                  <p className="text-xs text-gray-400">{[snap.option1_value, snap.option2_value].filter(Boolean).join(" / ")}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{fmt(item.line_total)}</p>
                <p className="text-xs text-gray-400">Qty {item.quantity} × {fmt(item.unit_price)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-2.5">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Subtotal</span><span>{fmt(order.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Shipping</span><span>{order.shipping_cost > 0 ? fmt(order.shipping_cost) : "Free"}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Payment</span><span className="capitalize">{(order.payment_method ?? "").replace(/_/g, " ")}</span>
        </div>
        <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t border-gray-100 dark:border-gray-800 pt-2.5">
          <span>Total</span><span className="text-orange-500">{fmt(order.total_amount)}</span>
        </div>
      </div>

      {/* Delivery address */}
      {addr && Object.keys(addr).length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Delivery Address</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">{addr.full_name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ""}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{addr.city}{addr.province ? `, ${addr.province}` : ""}</p>
          <p className="text-sm text-gray-400 mt-0.5">{addr.phone}</p>
        </div>
      )}

      {/* Cancel */}
      {isCancellable && (
        <button onClick={handleCancel} disabled={cancelling}
          className="w-full py-3 rounded-2xl border-2 border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold text-sm transition-colors disabled:opacity-40">
          {cancelling ? "Cancelling…" : "Cancel Order"}
        </button>
      )}
    </div>
  );
}
