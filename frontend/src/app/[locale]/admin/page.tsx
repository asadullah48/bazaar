"use client";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { Users, Package, Banknote } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { adminApi } from "@/lib/api";

interface Stats {
  pendingSellers: number;
  pendingProducts: number;
  pendingPayouts: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 hover:border-orange-200 dark:hover:border-orange-800 transition-colors"
    >
      <div className={`inline-flex p-2 rounded-lg mb-3 ${color}`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm text-gray-400 mt-0.5">{label}</p>
    </Link>
  );
}

export default function AdminOverviewPage() {
  const locale = useLocale();
  const { accessToken } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([
      adminApi.listSellers(accessToken, { status: "pending", limit: 1 }),
      adminApi.listProducts(accessToken, { status: "under_review", limit: 1 }),
      adminApi.listPayouts(accessToken, { status: "pending", limit: 1 }),
    ])
      .then(([sellers, products, payouts]) => {
        setStats({
          pendingSellers: sellers.total,
          pendingProducts: products.total,
          pendingPayouts: payouts.total,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Overview</h1>
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
        <StatCard
          label="Pending Sellers"
          value={stats?.pendingSellers ?? 0}
          icon={Users}
          href={`/${locale}/admin/sellers`}
          color="bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400"
        />
        <StatCard
          label="Products Under Review"
          value={stats?.pendingProducts ?? 0}
          icon={Package}
          href={`/${locale}/admin/products`}
          color="bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          label="Pending Payouts"
          value={stats?.pendingPayouts ?? 0}
          icon={Banknote}
          href={`/${locale}/admin/payouts`}
          color="bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400"
        />
      </div>
    </div>
  );
}
