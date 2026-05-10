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
