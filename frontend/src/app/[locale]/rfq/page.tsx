"use client";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { PlusCircle, FileText } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { rfqApi, RFQListItem } from "@/lib/api";
import { useRouter } from "next/navigation";

const STATUS_BADGE: Record<string, string> = {
  open:        "bg-blue-100 text-blue-700",
  quoted:      "bg-purple-100 text-purple-700",
  negotiating: "bg-orange-100 text-orange-700",
  accepted:    "bg-green-100 text-green-700",
  closed:      "bg-gray-100 text-gray-600",
};

export default function RFQListPage() {
  const locale = useLocale();
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [rfqs, setRfqs] = useState<RFQListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) { router.push(`/${locale}/auth/login`); return; }
    rfqApi.list(accessToken)
      .then((d) => setRfqs(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken, locale, router]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Request for Quotes</h1>
        <Link href={`/${locale}/rfq/new`}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors">
          <PlusCircle size={16} /> New RFQ
        </Link>
      </div>
      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : rfqs.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl">
          <FileText size={48} className="mx-auto text-gray-200 dark:text-gray-700 mb-4" />
          <p className="text-gray-400 mb-4">No RFQs yet. Create one to get bulk quotes from sellers.</p>
          <Link href={`/${locale}/rfq/new`} className="text-orange-500 hover:underline text-sm">Create your first RFQ</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {rfqs.map((r) => (
            <Link key={r.id} href={`/${locale}/rfq/${r.id}`}
              className="block bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 hover:border-orange-200 dark:hover:border-orange-900 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">{r.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Qty: {r.quantity} · {new Date(r.created_at).toLocaleDateString()}
                    {r.deadline_date && ` · Due: ${new Date(r.deadline_date).toLocaleDateString()}`}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${STATUS_BADGE[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {r.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
