"use client";
import { ShoppingBag } from "lucide-react";

export default function SellerOrdersPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Orders</h1>
      <div className="text-center py-16">
        <ShoppingBag size={48} className="mx-auto text-gray-200 dark:text-gray-700 mb-4" />
        <p className="text-gray-400">Order management coming soon.</p>
      </div>
    </div>
  );
}
