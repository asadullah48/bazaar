import { getTranslations } from "next-intl/server";
import { SearchResultCard } from "@/components/product/search-result-card";
import { searchApi, SearchItem } from "@/lib/api";

interface SearchPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { locale } = await params;
  const { q: rawQ = "", page: pageStr = "1" } = await searchParams;
  const t = await getTranslations("common");

  // Clamp query length to prevent oversized payloads
  const q = rawQ.slice(0, 200);
  const page = Math.max(1, parseInt(pageStr, 10) || 1);

  if (!q.trim()) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-gray-500 dark:text-gray-400">{t("search")}</p>
      </div>
    );
  }

  let result: { items: SearchItem[]; total: number; page: number; pages: number } = {
    items: [],
    total: 0,
    page: 1,
    pages: 0,
  };
  let fetchError = false;
  try {
    result = await searchApi.search(q, page);
  } catch (err) {
    console.error("[SearchPage] search fetch failed:", err);
    fetchError = true;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        {fetchError
          ? "Search unavailable"
          : `${result.total} result${result.total !== 1 ? "s" : ""} for “${q}”`}
      </h1>

      {fetchError ? (
        <div className="py-20 text-center">
          <p className="text-red-500 dark:text-red-400">
            Search is temporarily unavailable. Please try again.
          </p>
        </div>
      ) : result.items.length === 0 ? (
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            Page {result.page} of {result.pages || 1}
          </p>
          <div className="py-20 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No products found for &ldquo;{q}&rdquo;. Try a different search.
            </p>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            Page {result.page} of {result.pages || 1}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {result.items.map((item) => (
              <SearchResultCard key={item.id} item={item} locale={locale} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
