"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function SuccessContent() {
  const params = useSearchParams();
  const orders = params.get("orders")?.split(",").filter(Boolean) ?? [];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-6 bg-white dark:bg-gray-950">
      <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-4xl">
        ✓
      </div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Payment Successful!</h1>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm">
        Your payment has been confirmed. Your order is now being processed.
      </p>
      {orders.length > 0 && (
        <div className="text-sm text-gray-400">
          Order{orders.length > 1 ? "s" : ""}: {orders.map((id) => id.slice(0, 8)).join(", ")}…
        </div>
      )}
      <div className="flex gap-3 flex-wrap justify-center">
        <Link
          href="/en/orders"
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 px-6 rounded-xl transition-colors"
        >
          View My Orders
        </Link>
        <Link
          href="/en"
          className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-2.5 px-6 rounded-xl transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
