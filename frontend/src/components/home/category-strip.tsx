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
  { slug: "textiles",    label: "Textiles",      Icon: Shirt,           color: "bg-orange-50 text-orange-600 dark:bg-orange-900/20" },
  { slug: "electronics", label: "Electronics",    Icon: Smartphone,      color: "bg-blue-50 text-blue-600 dark:bg-blue-900/20" },
  { slug: "furniture",   label: "Furniture",      Icon: Sofa,            color: "bg-green-50 text-green-600 dark:bg-green-900/20" },
  { slug: "kitchen",     label: "Kitchen",        Icon: UtensilsCrossed, color: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20" },
  { slug: "auto-parts",  label: "Auto Parts",     Icon: Car,             color: "bg-red-50 text-red-600 dark:bg-red-900/20" },
  { slug: "toys",        label: "Toys & Kids",    Icon: Baby,            color: "bg-pink-50 text-pink-600 dark:bg-pink-900/20" },
  { slug: "tools",       label: "Tools",          Icon: Wrench,          color: "bg-gray-50 text-gray-600 dark:bg-gray-900/20" },
  { slug: "all",         label: "All Categories", Icon: ShoppingBag,     color: "bg-purple-50 text-purple-600 dark:bg-purple-900/20" },
] as const;

export function CategoryStrip({ locale }: { locale: string }) {
  const t = useTranslations("home");

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
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
