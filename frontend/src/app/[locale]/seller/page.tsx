"use client";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Package, ShoppingBag, PlusCircle } from "lucide-react";

export default function SellerDashboardPage() {
  const locale = useLocale();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
        <Link
          href={`/${locale}/seller/products`}
          className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 hover:border-orange-200 dark:hover:border-orange-800 transition-colors"
        >
          <Package size={24} className="text-orange-500 mb-3" />
          <p className="font-semibold text-gray-900 dark:text-white">My Products</p>
          <p className="text-xs text-gray-400 mt-1">View and manage your listings</p>
        </Link>
        <Link
          href={`/${locale}/seller/products/new`}
          className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 hover:border-orange-200 dark:hover:border-orange-800 transition-colors"
        >
          <PlusCircle size={24} className="text-orange-500 mb-3" />
          <p className="font-semibold text-gray-900 dark:text-white">New Product</p>
          <p className="text-xs text-gray-400 mt-1">Create a new product listing</p>
        </Link>
        <Link
          href={`/${locale}/seller/orders`}
          className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 transition-colors"
        >
          <ShoppingBag size={24} className="text-orange-500 mb-3" />
          <p className="font-semibold text-gray-900 dark:text-white">Orders</p>
          <p className="text-xs text-gray-400 mt-1">Track your incoming orders</p>
        </Link>
      </div>
    </div>
  );
}
