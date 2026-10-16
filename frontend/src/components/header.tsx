"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, ShoppingCart, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { useCartStore } from "@/store/cart-store";
import { categoriesApi, CategoryNode } from "@/lib/api";

export function Header() {
  const locale = useLocale(); const t = useTranslations(); const router = useRouter();
  const { openCart, totalItems } = useCartStore();
  const [query, setQuery] = useState(""); const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); categoriesApi.tree().then(setCategories).catch(() => {}); }, []);
  const text = (en: string, ar: string, ur: string) => locale === "ar" ? ar : locale === "ur" ? ur : en;
  return <header className="sticky top-0 z-30 border-b-2 border-orange-500 bg-white dark:bg-gray-950">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:block p-3">{text("Skip to content", "انتقل للمحتوى", "مواد پر جائیں")}</a>
    <div className="max-w-7xl mx-auto px-4 py-3 grid grid-cols-[1fr_auto] md:grid-cols-[auto_1fr_auto] gap-3 items-center">
      <Link href={`/${locale}`} className="text-2xl font-extrabold text-orange-700 dark:text-orange-400 tracking-tight">Bazaar<span className="text-cyan-700">.</span></Link>
      <form role="search" onSubmit={e => { e.preventDefault(); const qs = new URLSearchParams(); if(query.trim()) qs.set("q", query.trim()); if(category) qs.set("category_id", category); router.push(`/${locale}/products?${qs}`); }} className="order-3 col-span-2 md:order-none md:col-span-1 flex min-w-0 rounded-lg border border-gray-400 focus-within:ring-2 focus-within:ring-cyan-700">
        <label className="sr-only" htmlFor="search-category">{text("Category", "الفئة", "زمرہ")}</label>
        <select id="search-category" value={category} onChange={e => setCategory(e.target.value)} className="max-w-28 sm:max-w-40 bg-gray-100 dark:bg-gray-800 rounded-s-lg px-2 text-sm">
          <option value="">{text("All categories", "كل الفئات", "تمام زمرے")}</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="store-search">{t("common.search")}</label>
        <input id="store-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t("common.search")} className="min-w-0 flex-1 bg-transparent px-3 py-3"/>
        <button className="bg-orange-700 hover:bg-orange-800 text-white px-4 rounded-e-lg" aria-label={t("common.search")}><Search size={20}/></button>
      </form>
      <nav className="flex items-center gap-1" aria-label={text("Account and cart", "الحساب والسلة", "اکاؤنٹ اور ٹوکری")}>
        <LanguageSwitcher/>
        <Link href={`/${locale}/account`} className="p-2" aria-label={text("Account", "الحساب", "اکاؤنٹ")}><User size={20}/></Link>
        <button onClick={openCart} className="flex items-center gap-1 p-2" aria-label={`${t("nav.cart")} ${ready ? totalItems() : ""}`}><ShoppingCart size={20}/><span className="min-w-5 text-sm font-bold" aria-live="polite">{ready ? totalItems() : ""}</span></button>
      </nav>
    </div>
  </header>;
}
