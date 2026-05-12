"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Payout {
  id: string;
  period_start: string;
  period_end: string;
  gross_amount: number;
  commission_amount: number;
  processing_fees: number;
  net_amount: number;
  status: string;
}

interface Schedule {
  frequency: string;
  bank_name: string | null;
  account_number: string | null;
  account_title: string | null;
}

export default function FinancialsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch("/v1/seller/payouts").then((r) => r.json()),
      apiFetch("/v1/seller/payout-schedule").then((r) => r.json()),
    ]).then(([p, s]) => { setPayouts(p); setSchedule(s); })
      .finally(() => setLoading(false));
  }, []);

  const pending = payouts.find((p) => p.status === "pending");

  if (loading) return <div className="p-8">Loading financials...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Financials</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-500">Pending Payout</p>
          <p className="text-2xl font-bold mt-1">
            PKR {pending ? pending.net_amount.toLocaleString() : "0"}
          </p>
          <p className="text-xs text-gray-400 mt-1">Schedule: {schedule?.frequency ?? "not set"}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-500">Bank</p>
          <p className="text-lg font-medium mt-1">{schedule?.bank_name ?? "—"}</p>
          <p className="text-xs text-gray-400 mt-1">{schedule?.account_number ?? "—"}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-500">Account Title</p>
          <p className="text-lg font-medium mt-1">{schedule?.account_title ?? "—"}</p>
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-3">Payout History</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium text-right">Gross</th>
                <th className="px-4 py-3 font-medium text-right">Commission</th>
                <th className="px-4 py-3 font-medium text-right">Fees</th>
                <th className="px-4 py-3 font-medium text-right">Net</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payouts.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{p.period_start} → {p.period_end}</td>
                  <td className="px-4 py-3 text-right">PKR {p.gross_amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-red-500">-{p.commission_amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-red-500">-{p.processing_fees.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold">PKR {p.net_amount.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.status === "paid" ? "bg-green-100 text-green-700" :
                      p.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
              {payouts.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No payouts yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
