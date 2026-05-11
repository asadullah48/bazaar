"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { sellerPayoutsApi, SellerPayout } from "@/lib/api";

const STATUS_BADGE: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  paid:       "bg-green-100 text-green-700",
  failed:     "bg-red-100 text-red-700",
};

export default function SellerPayoutsPage() {
  const { accessToken } = useAuthStore();
  const [payouts, setPayouts] = useState<SellerPayout[]>([]);
  const [loading, setLoading] = useState(true);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(n);

  useEffect(() => {
    if (!accessToken) return;
    sellerPayoutsApi.list(accessToken)
      .then((d) => setPayouts(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  const totalPaid = payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.net_amount, 0);
  const totalPending = payouts.filter((p) => p.status !== "paid").reduce((s, p) => s + p.net_amount, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Payouts</h1>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-400 mb-1">Total Paid</p>
          <p className="text-2xl font-bold text-green-600">{fmt(totalPaid)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-400 mb-1">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{fmt(totalPending)}</p>
        </div>
      </div>
      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : payouts.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl">
          <p className="text-gray-400">No payouts yet. Complete orders to start earning.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-start px-4 py-3 font-semibold text-gray-500">Period</th>
                <th className="text-end px-4 py-3 font-semibold text-gray-500">Gross</th>
                <th className="text-end px-4 py-3 font-semibold text-gray-500">Commission</th>
                <th className="text-end px-4 py-3 font-semibold text-gray-500">Net</th>
                <th className="text-start px-4 py-3 font-semibold text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                    {new Date(p.period_start).toLocaleDateString()} – {new Date(p.period_end).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-end text-gray-600 dark:text-gray-400">{fmt(p.gross_amount)}</td>
                  <td className="px-4 py-3 text-end text-red-500">−{fmt(p.commission_amount)}</td>
                  <td className="px-4 py-3 text-end font-bold text-gray-900 dark:text-white">{fmt(p.net_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {p.status}
                    </span>
                    {p.bank_ref && <p className="text-[10px] text-gray-400 mt-0.5">{p.bank_ref}</p>}
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
