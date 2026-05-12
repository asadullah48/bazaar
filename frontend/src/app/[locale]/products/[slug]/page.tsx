import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Heart, Store, ChevronRight } from "lucide-react";
import { productsApi, ApiError } from "@/lib/api";
import { toProduct } from "@/lib/to-product";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductPrice } from "@/components/product/product-price";
import { Rating } from "@/components/product/rating";
import { ProductReviews } from "@/components/product/product-reviews";
import { AddToCartButton } from "@/components/product/add-to-cart-button";
import { Recommendations } from "@/components/product/recommendations";
import { ProductViewTracker } from "@/components/product/product-view-tracker";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://shopunity.pk";
  let product;
  try {
    product = await productsApi.get(slug);
  } catch {
    return {};
  }
  return {
    title: `${product.name} — ShopUnity`,
    alternates: {
      canonical: `${base}/${locale}/products/${slug}`,
      languages: {
        en: `${base}/en/products/${slug}`,
        ar: `${base}/ar/products/${slug}`,
        ur: `${base}/ur/products/${slug}`,
      },
    },
    openGraph: {
      title: product.name,
      images: product.images?.[0] ? [{ url: product.images[0].url }] : [],
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  const t = await getTranslations("product");

  let apiProduct;
  try {
    apiProduct = await productsApi.get(slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    notFound();
  }

  const product = toProduct(apiProduct);
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://shopunity.pk";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.id.slice(0, 8).toUpperCase(),
    image: product.images.map((img) => img.url),
    offers: {
      "@type": "Offer",
      priceCurrency: "PKR",
      price: product.price,
      availability:
        product.stock_qty > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: `${base}/${locale}/products/${slug}`,
    },
    ...(product.avg_rating && product.review_count
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.avg_rating,
            reviewCount: product.review_count,
          },
        }
      : {}),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* JSON-LD structured data — add this line manually (security hook blocks dangerouslySetInnerHTML): */}
      {/* <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> */}
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-gray-400 mb-6">
        <Link href={`/${locale}`} className="hover:text-orange-500 transition-colors">
          Home
        </Link>
        <ChevronRight size={12} />
        <Link href={`/${locale}/products`} className="hover:text-orange-500 transition-colors">
          Products
        </Link>
        <ChevronRight size={12} />
        <span className="text-gray-600 dark:text-gray-300 truncate max-w-xs">
          {product.name}
        </span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Gallery */}
        <ProductGallery images={product.images} name={product.name} />

        {/* Info */}
        <div className="flex flex-col gap-5">
          {/* Seller */}
          <Link
            href={`/${locale}/sellers/${product.seller.slug}`}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors w-fit"
          >
            <Store size={14} />
            {product.seller.display_name}
          </Link>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white leading-tight">
            {product.name}
          </h1>

          <Rating value={product.avg_rating} count={product.review_count} size={16} />

          <ProductPrice
            price={product.price}
            comparePrice={product.compare_price}
            className="text-xl"
          />

          {/* Stock status */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                product.stock_qty > 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-500"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  product.stock_qty > 0 ? "bg-green-500" : "bg-red-500"
                }`}
              />
              {product.stock_qty > 0
                ? `${t("in_stock")} (${product.stock_qty} available)`
                : t("out_of_stock")}
            </span>
          </div>

          {/* B2B badge */}
          {product.is_b2b_eligible && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full w-fit">
              B2B Wholesale Available
            </span>
          )}

          {/* Add to cart */}
          <AddToCartButton product={product} />

          {/* Wishlist */}
          <button className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors w-fit">
            <Heart size={16} />
            {t("add_to_wishlist")}
          </button>

          {/* SKU */}
          <p className="text-xs text-gray-400 dark:text-gray-600">
            {t("sku")}: {product.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
      </div>

      <ProductViewTracker productId={apiProduct.id} />
      {/* Reviews */}
      <ProductReviews productId={apiProduct.id} />
      <Recommendations productId={apiProduct.id} locale={locale} />
    </div>
  );
}
