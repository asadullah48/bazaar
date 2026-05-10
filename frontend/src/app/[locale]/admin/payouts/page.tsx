"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { adminApi, PayoutRecord } from "@/lib/api";

const STATUS_TABS = ["pending", "paid"] as const;

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(n);

export default function AdminPayoutsPage() {
  const { accessToken } = useAuthStore();
  const [tab, setTab] = useState<string>("pending");
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = (status: string) => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    adminApi
      .listPayouts(accessToken, { status })
      .then((data) => {
        setPayouts(data.items);
        setTotal(data.total);
      })
      .catch(() => setError("Failed to load payouts"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(tab);
  }, [accessToken, tab]);

  const handleMarkPaid = async (id: string) => {
    if (!accessToken) return;
    const bankRef = window.prompt("Bank reference number (required):");
    if (!bankRef?.trim()) return;
    try {
      await adminApi.markPayoutPaid(accessToken, id, bankRef.trim());
      load(tab);
    } catch {
      setError("Failed to mark payout as paid");
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payouts</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {total} {tab}
        </p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800/50 rounded-lg p-1 w-fit">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
              tab === s
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : payouts.length === 0 ? (
        <p className="text-gray-400 text-center py-16">No {tab} payouts.</p>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Seller</th>
                <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Period</th>
                <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Net Amount</th>
                <th className="text-start px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                <th className="text-end px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-gray-50 dark:border-gray-800/50 last:border-0"
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {p.seller_id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {p.period_start} → {p.period_end}
                  </td>
                  <td className="px-4 py-3 font-bold text-orange-500">
                    {fmt(p.net_amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        STATUS_BADGE[p.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      {p.status === "pending" && (
                        <button
                          onClick={() => handleMarkPaid(p.id)}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 transition-colors font-medium"
                        >
                          Mark Paid
                        </button>
                      )}
                      {p.status === "paid" && p.bank_ref && (
                        <span className="text-xs font-mono text-gray-400">{p.bank_ref}</span>
                      )}
                    </div>
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
