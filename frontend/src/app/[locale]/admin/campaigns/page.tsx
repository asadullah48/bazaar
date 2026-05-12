"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Plus, Zap } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

interface Campaign {
  id: string;
  title: string;
  slug: string;
  type: string;
  start_at: string;
  end_at: string;
  is_active: boolean;
  discount_pct: number | null;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminCampaignsPage() {
  const locale = useLocale();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  async function load() {
    try {
      const r = await fetch(`${base}/v1/campaigns/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (r.ok) {
        const data = await r.json();
        setCampaigns(data);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function activate(id: string) {
    setActivating(id);
    try {
      await fetch(`${base}/v1/campaigns/${id}/activate`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      await load();
    } finally {
      setActivating(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaigns</h1>
        <Link
          href={`/${locale}/admin/campaigns/new`}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={16} /> New Campaign
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
          <Zap size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No campaigns yet.</p>
          <Link
            href={`/${locale}/admin/campaigns/new`}
            className="mt-4 inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <Plus size={14} /> Create your first campaign
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                {["Title", "Type", "Start", "End", "Discount", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-950">
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.title}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 capitalize">{c.type.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{fmt(c.start_at)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{fmt(c.end_at)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {c.discount_pct != null ? `${c.discount_pct}%` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${c.is_active ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {!c.is_active && (
                      <button
                        onClick={() => activate(c.id)}
                        disabled={activating === c.id}
                        className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline disabled:opacity-50"
                      >
                        {activating === c.id ? "Activating…" : "Activate"}
                      </button>
                    )}
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
