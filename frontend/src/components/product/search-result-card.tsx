import Link from "next/link";
import { SearchItem } from "@/lib/api";

interface SearchResultCardProps {
  item: SearchItem;
  locale: string;
}

export function SearchResultCard({ item, locale }: SearchResultCardProps) {
  const priceLabel = item.min_price != null
    ? `PKR ${item.min_price.toLocaleString()}`
    : "Price not listed";

  const ariaLabel = [item.title, item.brand, priceLabel]
    .filter(Boolean)
    .join(" — ");

  if (!item.slug) {
    return (
      <div
        className="flex flex-col rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm gap-2 opacity-50"
        aria-label={ariaLabel}
      >
        <h3 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 leading-snug">
          {item.title}
        </h3>
        {item.brand && (
          <p className="text-xs text-gray-400 dark:text-gray-500">{item.brand}</p>
        )}
        <p className="mt-auto text-base font-bold text-orange-500">{priceLabel}</p>
      </div>
    );
  }

  return (
    <Link
      href={`/${locale}/products/${item.slug}`}
      aria-label={ariaLabel}
      className="flex flex-col rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm hover:shadow-md transition-shadow duration-200 gap-2"
    >
      <h3 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 leading-snug">
        {item.title}
      </h3>
      {item.brand && (
        <p className="text-xs text-gray-400 dark:text-gray-500">{item.brand}</p>
      )}
      <p className="mt-auto text-base font-bold text-orange-500">{priceLabel}</p>
    </Link>
  );
}
