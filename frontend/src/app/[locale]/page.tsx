import { Suspense } from "react";
import Link from "next/link";
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
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://shopunity.pk";

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ShopUnity",
    url: base,
    description: "Pakistan's premier B2C/B2B marketplace",
    address: {
      "@type": "PostalAddress",
      addressCountry: "PK",
    },
  };
  void orgJsonLd;

  return (
    <div className="pb-16">
      {/* JSON-LD: <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} /> */}
      <HeroCarousel />
      <CategoryStrip locale={locale} />

      {/* B2B Business Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-cyan-600 to-teal-700 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="inline-block text-xs font-semibold bg-white/20 text-white px-3 py-1 rounded-full mb-2">
              B2B Marketplace
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">
              Buying in bulk? Get competitive quotes instantly.
            </h2>
            <p className="text-cyan-100 text-sm mt-1">
              Post an RFQ and let verified Pakistani suppliers come to you.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link
              href={`/${locale}/rfq/new`}
              className="inline-flex items-center gap-2 bg-white text-cyan-700 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-cyan-50 transition-colors whitespace-nowrap"
            >
              Post RFQ
            </Link>
            <Link
              href={`/${locale}/rfq`}
              className="inline-flex items-center gap-2 border border-white/40 text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              View RFQs
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-6 rounded-full bg-brand-gradient" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t("featured")}
          </h2>
        </div>
        <Suspense fallback={<ProductGridSkeleton count={8} />}>
          <FeaturedProducts locale={locale} />
        </Suspense>
      </section>
    </div>
  );
}
