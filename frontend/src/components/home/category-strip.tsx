import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Shirt,
  Smartphone,
  Sofa,
  UtensilsCrossed,
  Car,
  Baby,
  Wrench,
  ShoppingBag,
} from "lucide-react";

const CATEGORIES = [
  { slug: "textiles",    label: "Textiles",      Icon: Shirt,           color: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 group-hover:bg-orange-100 dark:group-hover:bg-orange-900/40" },
  { slug: "electronics", label: "Electronics",    Icon: Smartphone,      color: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900/40" },
  { slug: "furniture",   label: "Furniture",      Icon: Sofa,            color: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40" },
  { slug: "kitchen",     label: "Kitchen",        Icon: UtensilsCrossed, color: "bg-teal-50 text-teal-700 dark:bg-teal-900/20 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/40" },
  { slug: "auto-parts",  label: "Auto Parts",     Icon: Car,             color: "bg-orange-50 text-orange-700 dark:bg-orange-900/20 group-hover:bg-orange-100 dark:group-hover:bg-orange-900/40" },
  { slug: "toys",        label: "Toys & Kids",    Icon: Baby,            color: "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900/40" },
  { slug: "tools",       label: "Tools",          Icon: Wrench,          color: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40" },
  { slug: "all",         label: "All Categories", Icon: ShoppingBag,     color: "bg-gradient-to-br from-orange-50 to-cyan-50 text-orange-600 dark:bg-cyan-900/20 group-hover:from-orange-100 group-hover:to-cyan-100" },
] as const;

export function CategoryStrip({ locale }: { locale: string }) {
  const t = useTranslations("home");

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
      <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 text-brand-gradient">
        {t("categories")}
      </h3>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
        {CATEGORIES.map(({ slug, label, Icon, color }) => (
          <Link
            key={slug}
            href={`/${locale}/categories/${slug}`}
            className="flex flex-col items-center gap-2 group"
          >
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center ${color} group-hover:scale-105 transition-transform duration-200`}
            >
              <Icon size={24} />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center leading-tight">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
