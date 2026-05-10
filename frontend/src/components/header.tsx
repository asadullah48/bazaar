"use client";
import { useState } from "react";
import Link from "next/link";
import { ShoppingCart, Search, User, Package, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";
import { useCartStore } from "@/store/cart-store";
import { useAuthStore } from "@/store/auth-store";
import { authApi } from "@/lib/api";

export function Header() {
  const t = useTranslations();
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const { openCart, totalItems } = useCartStore();
  const count = totalItems();
  const [query, setQuery] = useState("");

  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  const role = useAuthStore((s) => s.role);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearTokens = useAuthStore((s) => s.clearTokens);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/${locale}/search?q=${encodeURIComponent(query.trim())}`);
  }

  async function handleSignOut() {
    if (refreshToken) {
      try { await authApi.logout(refreshToken); } catch {}
    }
    clearTokens();
    router.push(`/${locale}`);
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-4">
          {/* Logo */}
          <Link
            href={`/${locale}`}
            className="flex-shrink-0 font-bold text-2xl text-orange-500 tracking-tight"
          >
            ShopUnity
          </Link>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-auto">
            <div className="relative">
              <Search
                size={16}
                className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("common.search")}
                className="w-full ps-9 pe-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:text-gray-100 placeholder:text-gray-400"
              />
            </div>
          </form>

          {/* Right controls */}
          <nav className="flex items-center gap-2 flex-shrink-0">
            <LanguageSwitcher />
            <ThemeToggle />
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:block">
                  {role}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-red-500 transition-colors px-2 py-1"
                >
                  {tAuth("sign_out")}
                </button>
              </div>
            ) : (
              <Link
                href={`/${locale}/auth/login`}
                aria-label={tAuth("sign_in")}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <User size={20} />
              </Link>
            )}

            {accessToken && (
              <>
                <Link
                  href={`/${locale}/orders`}
                  className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label={t("nav.orders")}
                >
                  <Package size={20} />
                </Link>
                <button
                  onClick={handleSignOut}
                  className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label={t("auth.sign_out")}
                >
                  <LogOut size={20} />
                </button>
              </>
            )}

            {/* Cart button with badge */}
            <button
              onClick={openCart}
              className="relative p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={t("nav.cart")}
            >
              <ShoppingCart size={20} />
              {count > 0 && (
                <span className="absolute -top-0.5 -end-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
