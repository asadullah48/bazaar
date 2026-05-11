"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

const REASON_MESSAGES: Record<string, string> = {
  missing_txn: "No transaction reference was received from the gateway.",
  order_not_found: "We could not match the payment to an order. Please contact support.",
};

function FailureContent() {
  const params = useSearchParams();
  const reason = params.get("reason") ?? "";
  const orders = params.get("orders")?.split(",").filter(Boolean) ?? [];
  const message = REASON_MESSAGES[reason] ?? "Your payment could not be completed. Please try again.";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-6 bg-white dark:bg-gray-950">
      <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-4xl">
        ✕
      </div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Payment Failed</h1>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm">{message}</p>
      {orders.length > 0 && (
        <div className="text-sm text-gray-400">
          Order ref: {orders.map((id) => id.slice(0, 8)).join(", ")}…
        </div>
      )}
      <div className="flex gap-3 flex-wrap justify-center">
        <Link
          href="/en/checkout"
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 px-6 rounded-xl transition-colors"
        >
          Try Again
        </Link>
        <Link
          href="/en"
          className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-2.5 px-6 rounded-xl transition-colors"
        >
          Back to Home
        </Link>
      </div>
      <p className="text-xs text-gray-400">
        If money was deducted, contact{" "}
        <a href="mailto:support@shopunity.pk" className="underline hover:text-orange-500">
          support@shopunity.pk
        </a>
      </p>
    </div>
  );
}

export default function PaymentFailurePage() {
  return (
    <Suspense>
      <FailureContent />
    </Suspense>
  );
}
