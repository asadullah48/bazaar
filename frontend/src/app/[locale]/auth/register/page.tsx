"use client";
import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { authApi, ApiError } from "@/lib/api";
import clsx from "clsx";

type Role = "consumer" | "business_buyer" | "seller";

const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: "consumer",       label: "Shopper",         desc: "Buy products for personal use" },
  { value: "business_buyer", label: "Business Buyer",  desc: "Bulk orders & B2B pricing" },
  { value: "seller",         label: "Sell on ShopUnity",  desc: "List & sell your products" },
];

export default function RegisterPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [role, setRole]         = useState<Role>("consumer");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.register({ email, password, role });
      setSuccess(true);
      setTimeout(() => router.push(`/${locale}/auth/login`), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-orange-500">ShopUnity</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{t("register")}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-8 space-y-5"
        >
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm px-4 py-3 rounded-xl">
              Account created! Redirecting to login…
            </div>
          )}

          {/* Role selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">I want to…</p>
            <div className="grid grid-cols-1 gap-2">
              {ROLES.map((r) => (
                <label
                  key={r.value}
                  className={clsx(
                    "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                    role === r.value
                      ? "border-orange-400 bg-orange-50 dark:bg-orange-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-orange-200"
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={() => setRole(r.value)}
                    className="mt-0.5 accent-orange-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{r.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{r.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("email")}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("password")} <span className="text-gray-400 font-normal">(min 8 chars)</span>
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 pe-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400"
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            <UserPlus size={16} />
            {loading ? "Creating account…" : t("register")}
          </button>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{" "}
            <Link
              href={`/${locale}/auth/login`}
              className="text-orange-500 font-medium hover:underline"
            >
              {t("sign_in")}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
