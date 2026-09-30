import { Suspense } from "react";
import Script from "next/script";
import { ProductCard } from "@/components/product/product-card";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
import { productsApi, categoriesApi } from "@/lib/api";
import { toProduct } from "@/lib/to-product";
import Link from "next/link";
import clsx from "clsx";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; q?: string; min_price?: string; max_price?: string; category?: string }>;
}

async function ProductGrid({
  locale,
  page,
  q,
  minPrice,
  maxPrice,
  categoryId,
  category,
}: {
  locale: string;
  page: number;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  categoryId?: string;
  category?: string;
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
      category_id: categoryId,
    });
  } catch {
    return (
      <p className="text-sm text-gray-400 py-16 text-center col-span-full">
        Products are temporarily unavailable. Please try again shortly.
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
            if (category) qs.set("category", category);
            if (minPrice != null) qs.set("min_price", String(minPrice));
            if (maxPrice != null) qs.set("max_price", String(maxPrice));
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
  const page = Math.max(1, (parseInt(sp.page ?? "1", 10) || 1));
  const q = sp.q;
  const minPrice = sp.min_price && Number.isFinite(Number(sp.min_price)) ? Math.max(0, Number(sp.min_price)) : undefined;
  const maxPrice = sp.max_price && Number.isFinite(Number(sp.max_price)) ? Math.max(0, Number(sp.max_price)) : undefined;
  const categories = await categoriesApi.tree().catch(() => []);
  const categoryId = categories.find(c => c.slug === sp.category)?.id;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://shopunity.pk";

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${base}/${locale}` },
      { "@type": "ListItem", position: 2, name: "Products", item: `${base}/${locale}/products` },
    ],
  };
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Script id="breadcrumb-jsonld" type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</Script>
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
      <form action={`/${locale}/products`} className="grid sm:grid-cols-5 gap-3 mb-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl">
        <div className="sm:col-span-2"><label className="demo-label" htmlFor="catalog-q">Search catalog</label><input id="catalog-q" className="demo-input" name="q" defaultValue={q} placeholder="Try cotton or cookware" /></div>
        <div><label className="demo-label" htmlFor="catalog-category">Category</label><select id="catalog-category" className="demo-input" name="category" defaultValue={sp.category ?? ""}><option value="">All categories</option>{categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}</select></div>
        <div><label className="demo-label" htmlFor="catalog-max">Maximum PKR</label><input id="catalog-max" className="demo-input" type="number" name="max_price" min="0" defaultValue={maxPrice} placeholder="Any price" /></div>
        <button className="demo-button self-end">Apply filters</button>
      </form>
      <Suspense fallback={<ProductGridSkeleton count={16} />}>
        <ProductGrid
          locale={locale}
          page={page}
          q={q}
          minPrice={minPrice}
          maxPrice={maxPrice}
          categoryId={categoryId}
          category={sp.category}
        />
      </Suspense>
    </div>
  );
}
