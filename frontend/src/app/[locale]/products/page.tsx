import { Suspense } from "react";
import { ProductCard } from "@/components/product/product-card";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
import { productsApi } from "@/lib/api";
import { toProduct } from "@/lib/to-product";
import Link from "next/link";
import clsx from "clsx";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; q?: string; min_price?: string; max_price?: string }>;
}

async function ProductGrid({
  locale,
  page,
  q,
  minPrice,
  maxPrice,
}: {
  locale: string;
  page: number;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
}) {
  const SIZE = 16;
  let result;
  try {
    result = await productsApi.list({
      page,
      size: SIZE,
      search: q,
      min_price: minPrice,
      max_price: maxPrice,
    });
  } catch {
    return (
      <p className="text-sm text-gray-400 py-16 text-center col-span-full">
        Could not load products. Make sure the backend is running on port 8000.
      </p>
    );
  }

  const products = result.items.map(toProduct);
  const totalPages = Math.ceil(result.total / SIZE);

  return (
    <div className="space-y-8">
      {products.length === 0 ? (
        <p className="text-sm text-gray-400 py-16 text-center">No products found.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} locale={locale} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }).map((_, i) => {
            const pg = i + 1;
            const qs = new URLSearchParams();
            qs.set("page", String(pg));
            if (q) qs.set("q", q);
            return (
              <Link
                key={pg}
                href={`/${locale}/products?${qs}`}
                className={clsx(
                  "w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors",
                  pg === page
                    ? "bg-orange-500 text-white"
                    : "border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                {pg}
              </Link>
            );
          })}
        </nav>
      )}

      <p className="text-center text-xs text-gray-400 dark:text-gray-600">
        {result.total} product{result.total !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

export default async function ProductsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const q = sp.q;
  const minPrice = sp.min_price ? parseFloat(sp.min_price) : undefined;
  const maxPrice = sp.max_price ? parseFloat(sp.max_price) : undefined;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://shopunity.pk";

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${base}/${locale}` },
      { "@type": "ListItem", position: 2, name: "Products", item: `${base}/${locale}/products` },
    ],
  };
  void breadcrumbJsonLd;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* JSON-LD: <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} /> */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          All Products
        </h1>
        {q && (
          <p className="text-sm text-gray-500">
            Results for <span className="font-medium text-gray-900 dark:text-white">&ldquo;{q}&rdquo;</span>
          </p>
        )}
      </div>
      <Suspense fallback={<ProductGridSkeleton count={16} />}>
        <ProductGrid
          locale={locale}
          page={page}
          q={q}
          minPrice={minPrice}
          maxPrice={maxPrice}
        />
      </Suspense>
    </div>
  );
}
