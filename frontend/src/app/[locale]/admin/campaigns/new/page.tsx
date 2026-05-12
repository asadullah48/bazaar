"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuthStore } from "@/store/auth-store";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function NewCampaignPage() {
  const locale = useLocale();
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [form, setForm] = useState({
    title: "",
    slug: "",
    type: "flash_sale",
    start_at: "",
    end_at: "",
    banner_url: "",
    discount_pct: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field: string, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "title") next.slug = slugify(value);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const body: Record<string, unknown> = {
      title: form.title,
      slug: form.slug,
      type: form.type,
      start_at: new Date(form.start_at).toISOString(),
      end_at: new Date(form.end_at).toISOString(),
    };
    if (form.banner_url) body.banner_url = form.banner_url;
    if (form.discount_pct) body.discount_pct = parseFloat(form.discount_pct);

    try {
      const r = await fetch(`${base}/v1/campaigns/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.detail ?? "Failed to create campaign");
        return;
      }
      router.push(`/${locale}/admin/campaigns`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">New Campaign</h1>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title" required>
          <input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:text-gray-100"
            placeholder="Summer Sale 2026"
            required
          />
        </Field>
        <Field label="Slug">
          <input
            value={form.slug}
            onChange={(e) => set("slug", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400 dark:text-gray-100"
            placeholder="summer-sale-2026"
            pattern="^[a-z0-9-]+$"
            required
          />
        </Field>
        <Field label="Type" required>
          <select
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:text-gray-100"
          >
            <option value="flash_sale">Flash Sale</option>
            <option value="editorial">Editorial</option>
            <option value="brand_promo">Brand Promo</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start" required>
            <input
              type="datetime-local"
              value={form.start_at}
              onChange={(e) => set("start_at", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:text-gray-100"
              required
            />
          </Field>
          <Field label="End" required>
            <input
              type="datetime-local"
              value={form.end_at}
              onChange={(e) => set("end_at", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:text-gray-100"
              required
            />
          </Field>
        </div>
        <Field label="Discount %">
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={form.discount_pct}
            onChange={(e) => set("discount_pct", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:text-gray-100"
            placeholder="25"
          />
        </Field>
        <Field label="Banner URL">
          <input
            value={form.banner_url}
            onChange={(e) => set("banner_url", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:text-gray-100"
            placeholder="https://cdn.example.com/banner.jpg"
          />
        </Field>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Campaign"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}{required && <span className="text-red-500 ms-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
