"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface InventoryRow {
  variant_id: string;
  product_title: string;
  sku_code: string | null;
  option1_name: string | null;
  option1_value: string | null;
  stock_qty: number;
  threshold: number | null;
  auto_pause: boolean | null;
  is_active: boolean;
}

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/v1/seller/inventory")
      .then((r) => r.json())
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const exportCsv = () => {
    window.open(`${process.env.NEXT_PUBLIC_API_URL}/v1/seller/inventory/export`, "_blank");
  };

  if (loading) return <div className="p-8">Loading inventory...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <button onClick={exportCsv}
          className="px-4 py-2 bg-gray-100 rounded text-sm font-medium hover:bg-gray-200">
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Variant</th>
              <th className="px-4 py-3 font-medium text-right">Stock</th>
              <th className="px-4 py-3 font-medium text-right">Threshold</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.variant_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{row.product_title}</td>
                <td className="px-4 py-3 text-gray-500">{row.sku_code ?? "—"}</td>
                <td className="px-4 py-3">
                  {row.option1_name && row.option1_value
                    ? `${row.option1_name}: ${row.option1_value}` : "Default"}
                </td>
                <td className={`px-4 py-3 text-right font-mono ${
                  row.stock_qty === 0 ? "text-red-600 font-bold" :
                  row.threshold && row.stock_qty <= row.threshold ? "text-orange-500" : ""}`}>
                  {row.stock_qty}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-500">
                  {row.threshold ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    row.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {row.is_active ? "Active" : "Paused"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
