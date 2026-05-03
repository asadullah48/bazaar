import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { CategoryStrip } from "@/components/home/category-strip";
import { ProductCard } from "@/components/product/product-card";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
import { productsApi } from "@/lib/api";
import { toProduct } from "@/lib/to-product";

async function FeaturedProducts({ locale }: { locale: string }) {
  let products = [];
  try {
    const res = await productsApi.list({ size: 8 });
    products = res.items.map(toProduct);
  } catch {
    // Backend may not be running in dev — graceful fallback
    return (
      <p className="text-sm text-gray-400 dark:text-gray-600 py-8 text-center">
        Could not load products. Make sure the backend is running on port 8000.
      </p>
    );
  }

  if (products.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-600 py-8 text-center">
        No products yet. Add some from the seller dashboard.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} locale={locale} />
      ))}
    </div>
  );
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("home");

  return (
    <div className="pb-16">
      <HeroCarousel />
      <CategoryStrip locale={locale} />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {t("featured")}
        </h2>
        <Suspense fallback={<ProductGridSkeleton count={8} />}>
          <FeaturedProducts locale={locale} />
        </Suspense>
      </section>
    </div>
  );
}
