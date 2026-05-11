"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { rfqApi, RFQDetail, RFQQuoteItem, ApiError } from "@/lib/api";

const STATUS_BADGE: Record<string, string> = {
  open:        "bg-blue-100 text-blue-700",
  quoted:      "bg-purple-100 text-purple-700",
  negotiating: "bg-orange-100 text-orange-700",
  accepted:    "bg-green-100 text-green-700",
  closed:      "bg-gray-100 text-gray-600",
};

const QUOTE_BADGE: Record<string, string> = {
  pending:  "bg-yellow-100 text-yellow-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  countered:"bg-orange-100 text-orange-700",
};

export default function RFQDetailPage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const { accessToken, role } = useAuthStore();
  const [rfq, setRfq] = useState<RFQDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [counterValue, setCounterValue] = useState<Record<string, string>>({});
  const [quoteForm, setQuoteForm] = useState({ unit_price: "", lead_time_days: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const id = params.id as string;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(n);

  function reload() {
    if (!accessToken) return;
    setLoading(true);
    rfqApi.get(accessToken, id).then(setRfq).catch(() => setError("RFQ not found")).finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!accessToken) { router.push(`/${locale}/auth/login`); return; }
    reload();
  }, [accessToken, id, locale, router]);

  async function accept(quoteId: string) {
    if (!accessToken || !rfq) return;
    try {
      const res = await rfqApi.acceptQuote(accessToken, rfq.id, quoteId);
      alert(`Order created: ${res.order_number} — ${fmt(res.total_amount)}`);
      reload();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Failed"); }
  }

  async function reject(quoteId: string) {
    if (!accessToken || !rfq || !confirm("Reject this quote?")) return;
    try { await rfqApi.rejectQuote(accessToken, rfq.id, quoteId); reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Failed"); }
  }

  async function counter(quote: RFQQuoteItem) {
    if (!accessToken || !rfq) return;
    const price = parseFloat(counterValue[quote.id] ?? "");
    if (!price) return;
    try { await rfqApi.counterQuote(accessToken, rfq.id, quote.id, price); setCounterValue({}); reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Failed"); }
  }

  async function submitQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !rfq) return;
    setSubmitting(true);
    try {
      await rfqApi.submitQuote(accessToken, rfq.id, {
        unit_price: parseFloat(quoteForm.unit_price),
        lead_time_days: quoteForm.lead_time_days ? parseInt(quoteForm.lead_time_days) : undefined,
        notes: quoteForm.notes || undefined,
      });
      setQuoteForm({ unit_price: "", lead_time_days: "", notes: "" });
      reload();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Failed"); }
    finally { setSubmitting(false); }
  }

  async function closeRFQ() {
    if (!accessToken || !rfq || !confirm("Close this RFQ?")) return;
    try { await rfqApi.close(accessToken, rfq.id); reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Failed"); }
  }

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-10 text-gray-400">Loading…</div>;
  if (!rfq) return (
    <div className="max-w-2xl mx-auto px-4 py-10 text-center">
      <p className="text-gray-400">{error || "RFQ not found"}</p>
      <Link href={`/${locale}/rfq`} className="text-orange-500 hover:underline mt-4 block">Back to RFQs</Link>
    </div>
  );

  const isBuyer = role === "consumer" || role === "business_buyer";
  const isSeller = role === "seller";
  const inp = "px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/rfq`} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft size={18} className="text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{rfq.title}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{new Date(rfq.created_at).toLocaleDateString()}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[rfq.status] ?? "bg-gray-100 text-gray-600"}`}>
          {rfq.status}
        </span>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div><span className="text-gray-400">Quantity:</span> <span className="font-medium text-gray-900 dark:text-white">{rfq.quantity.toLocaleString()}</span></div>
          {rfq.target_price != null && <div><span className="text-gray-400">Target:</span> <span className="font-medium text-gray-900 dark:text-white">{fmt(rfq.target_price)}/unit</span></div>}
          {rfq.delivery_city && <div><span className="text-gray-400">City:</span> <span className="font-medium text-gray-900 dark:text-white">{rfq.delivery_city}</span></div>}
          {rfq.payment_terms && <div><span className="text-gray-400">Terms:</span> <span className="font-medium text-gray-900 dark:text-white">{rfq.payment_terms}</span></div>}
          {rfq.deadline_date && <div><span className="text-gray-400">Deadline:</span> <span className="font-medium text-gray-900 dark:text-white">{new Date(rfq.deadline_date).toLocaleDateString()}</span></div>}
        </div>
        {rfq.description && <p className="text-sm text-gray-600 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">{rfq.description}</p>}
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Quotes ({rfq.quotes.length})</h2>
        </div>
        {rfq.quotes.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">No quotes yet.</p>
        ) : rfq.quotes.map((q) => (
          <div key={q.id} className="px-5 py-4 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{fmt(q.unit_price)}/unit</span>
                  {q.counter_price != null && <span className="text-xs text-orange-500">→ Counter: {fmt(q.counter_price)}/unit</span>}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${QUOTE_BADGE[q.status] ?? "bg-gray-100 text-gray-600"}`}>{q.status}</span>
                </div>
                {q.lead_time_days && <p className="text-xs text-gray-400 mt-1">Lead: {q.lead_time_days} days</p>}
                {q.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{q.notes}</p>}
                <p className="text-xs text-gray-400 mt-1">Total: {fmt(q.unit_price * rfq.quantity)}</p>
              </div>
              {isBuyer && rfq.status !== "accepted" && rfq.status !== "closed" && q.status === "pending" && (
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => accept(q.id)} className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium">Accept</button>
                  <button onClick={() => reject(q.id)} className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-medium">Reject</button>
                  <div className="flex gap-1">
                    <input value={counterValue[q.id] ?? ""} type="number" min="0" placeholder="Counter"
                      onChange={(e) => setCounterValue((v) => ({ ...v, [q.id]: e.target.value }))}
                      className="w-20 text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900" />
                    <button onClick={() => counter(q)} className="text-xs bg-orange-50 hover:bg-orange-100 text-orange-600 px-2 py-1 rounded-lg font-medium">Send</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {isSeller && rfq.status === "open" && (
        <form onSubmit={submitQuote} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Submit Quote</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Unit Price (PKR) *</label>
              <input required type="number" min="0" value={quoteForm.unit_price} onChange={(e) => setQuoteForm((f) => ({ ...f, unit_price: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Lead Time (days)</label>
              <input type="number" min="1" value={quoteForm.lead_time_days} onChange={(e) => setQuoteForm((f) => ({ ...f, lead_time_days: e.target.value }))} className={inp} />
            </div>
          </div>
          <textarea rows={2} value={quoteForm.notes} onChange={(e) => setQuoteForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Notes…" className={`${inp} w-full resize-none`} />
          <button type="submit" disabled={submitting || !quoteForm.unit_price}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
            {submitting ? "Submitting…" : "Submit Quote"}
          </button>
        </form>
      )}

      {isBuyer && rfq.status === "open" && (
        <button onClick={closeRFQ}
          className="w-full py-3 rounded-2xl border-2 border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold text-sm transition-colors">
          Close RFQ
        </button>
      )}
    </div>
  );
}
