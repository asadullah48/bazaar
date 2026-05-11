"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { rfqApi, ApiError } from "@/lib/api";

export default function NewRFQPage() {
  const locale = useLocale();
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "", quantity: "", description: "",
    target_price: "", delivery_city: "", payment_terms: "", deadline_date: "",
  });

  const inp = "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400";
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) { router.push(`/${locale}/auth/login`); return; }
    setLoading(true); setError("");
    try {
      const rfq = await rfqApi.create(accessToken, {
        title: form.title,
        quantity: parseInt(form.quantity),
        description: form.description || undefined,
        target_price: form.target_price ? parseFloat(form.target_price) : undefined,
        delivery_city: form.delivery_city || undefined,
        payment_terms: form.payment_terms || undefined,
        deadline_date: form.deadline_date || undefined,
      });
      router.push(`/${locale}/rfq/${rfq.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create RFQ");
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${locale}/rfq`} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft size={18} className="text-gray-500" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New RFQ</h1>
      </div>
      <form onSubmit={submit} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 space-y-4">
        {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Item Description *</label>
          <input required value={form.title} onChange={set("title")} placeholder="e.g. Cotton Fabric 40s, white, 1000 meters" className={inp} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Quantity *</label>
            <input required type="number" min="1" value={form.quantity} onChange={set("quantity")} placeholder="e.g. 1000" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Target Price (PKR/unit)</label>
            <input type="number" min="0" value={form.target_price} onChange={set("target_price")} placeholder="Optional" className={inp} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Specifications</label>
          <textarea rows={3} value={form.description} onChange={set("description")}
            placeholder="Quality, certifications, packaging requirements…" className={`${inp} resize-none`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Delivery City</label>
            <input value={form.delivery_city} onChange={set("delivery_city")} placeholder="e.g. Karachi" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Payment Terms</label>
            <select value={form.payment_terms} onChange={set("payment_terms")} className={inp}>
              <option value="">Select…</option>
              <option value="advance">100% Advance</option>
              <option value="net15">Net 15</option>
              <option value="net30">Net 30</option>
              <option value="lc">Letter of Credit</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Quote Deadline</label>
          <input type="date" value={form.deadline_date} onChange={set("deadline_date")} className={inp} />
        </div>
        <button type="submit" disabled={loading || !form.title || !form.quantity}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold py-3 rounded-xl transition-colors">
          {loading ? "Submitting…" : "Submit RFQ"}
        </button>
      </form>
    </div>
  );
}
