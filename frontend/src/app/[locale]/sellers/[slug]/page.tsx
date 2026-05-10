import { notFound } from "next/navigation";
import { Star, MapPin, Package } from "lucide-react";
import { Suspense } from "react";
import { sellersApi, ApiError } from "@/lib/api";
import { catalogItemToProduct } from "@/lib/catalog-item-to-product";
import { ProductCard } from "@/components/product/product-card";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

async function SellerProducts({
  slug,
  locale,
  page,
  storeName,
}: {
  slug: string;
  locale: string;
  page: number;
  storeName: string;
}) {
  let data;
  try {
    data = await sellersApi.storefront(slug, page);
  } catch {
    return (
      <p className="text-sm text-gray-400 py-16 text-center col-span-full">
        Could not load products.
      </p>
    );
  }

  const seller = { id: "", display_name: storeName, slug };
  const products = data.products.items.map((item) =>
    catalogItemToProduct(item, seller)
  );

  return (
    <div className="space-y-8">
      {products.length === 0 ? (
        <p className="text-sm text-gray-400 py-16 text-center">
          No products listed yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} locale={locale} />
          ))}
        </div>
      )}
      <p className="text-center text-xs text-gray-400 dark:text-gray-600">
        {data.products.total} product
        {data.products.total !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

export default async function SellerStorefrontPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  let data;
  try {
    data = await sellersApi.storefront(slug, page);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    notFound();
  }

  const avgRating =
    data.review_count > 0
      ? (data.total_rating / data.review_count).toFixed(1)
      : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Seller header card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 mb-8 flex flex-col sm:flex-row gap-5 items-start">
        <div className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl font-bold text-orange-500">
            {data.store_name.charAt(0).toUpperCase()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {data.store_name}
          </h1>

          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
            {data.city && (
              <span className="flex items-center gap-1">
                <MapPin size={14} />
                {data.city}
              </span>
            )}
            {avgRating && (
              <span className="flex items-center gap-1">
                <Star size={14} className="fill-amber-400 text-amber-400" />
                {avgRating} ({data.review_count} reviews)
              </span>
            )}
            <span className="flex items-center gap-1">
              <Package size={14} />
              {data.products.total} products
            </span>
          </div>

          {data.description && (
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-xl">
              {data.description}
            </p>
          )}
        </div>
      </div>

      {/* Products grid */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">
        All Products
      </h2>
      <Suspense fallback={<ProductGridSkeleton count={16} />}>
        <SellerProducts
          slug={slug}
          locale={locale}
          page={page}
          storeName={data.store_name}
        />
      </Suspense>
    </div>
  );
}
