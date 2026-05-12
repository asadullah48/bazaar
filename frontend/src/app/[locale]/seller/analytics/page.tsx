"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Summary {
  period_days: number;
  total_revenue: number;
  order_count: number;
  top_products: { title: string; units_sold: number }[];
}

const PERIODS = [7, 30, 90];

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/v1/seller/analytics/summary?days=${days}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex gap-2">
          {PERIODS.map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                days === d ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>
      {loading || !data ? <div className="text-gray-400">Loading...</div> : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border p-5">
              <p className="text-sm text-gray-500">Revenue (last {days}d)</p>
              <p className="text-3xl font-bold mt-1">PKR {data.total_revenue.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border p-5">
              <p className="text-sm text-gray-500">Orders (last {days}d)</p>
              <p className="text-3xl font-bold mt-1">{data.order_count}</p>
            </div>
          </div>
          <div className="rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-600 mb-3">Top Products</h2>
            {data.top_products.length === 0
              ? <p className="text-gray-400 text-sm">No sales in this period</p>
              : <ul className="space-y-2">
                  {data.top_products.map((p, i) => (
                    <li key={p.title} className="flex items-center justify-between">
                      <span className="text-sm"><span className="text-gray-400 mr-2">#{i + 1}</span>{p.title}</span>
                      <span className="text-sm font-medium">{p.units_sold} units</span>
                    </li>
                  ))}
                </ul>}
          </div>
        </>
      )}
    </div>
  );
}
