import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { getTranslations } from "next-intl/server";
import { Store, ChevronRight } from "lucide-react";
import { productsApi, ApiError } from "@/lib/api";
import { toProduct } from "@/lib/to-product";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductPrice } from "@/components/product/product-price";
import { Rating } from "@/components/product/rating";
import { ProductReviews } from "@/components/product/product-reviews";
import { AddToCartButton } from "@/components/product/add-to-cart-button";
import { Recommendations } from "@/components/product/recommendations";
import { ProductViewTracker } from "@/components/product/product-view-tracker";
import { ProductQr } from "@/components/product/product-qr";

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
  const seo = product.seo_data as Record<string, string> | null | undefined;
  return {
    title: seo?.title ?? `${product.name} — Bazaar`,
    description: seo?.meta_description,
    alternates: {
      canonical: `${base}/${locale}/products/${slug}`,
      languages: {
        en: `${base}/en/products/${slug}`,
        ar: `${base}/ar/products/${slug}`,
        ur: `${base}/ur/products/${slug}`,
      },
    },
    openGraph: {
      title: seo?.title ?? product.name,
      description: seo?.meta_description,
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
      <Script id="product-jsonld" type="application/ld+json">{JSON.stringify(jsonLd)}</Script>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 mb-6">
        <Link href={`/${locale}`} className="hover:text-orange-700 dark:text-orange-300 transition-colors">
          {locale === "ar" ? "الرئيسية" : locale === "ur" ? "ہوم" : "Home"}
        </Link>
        <ChevronRight size={12} />
        <Link href={`/${locale}/products`} className="hover:text-orange-700 dark:text-orange-300 transition-colors">
          {locale === "ar" ? "المنتجات" : locale === "ur" ? "مصنوعات" : "Products"}
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
        <div className="flex flex-col gap-5 border rounded-2xl p-5 h-fit md:sticky md:top-28">
          {/* Seller */}
          <Link
            href={`/${locale}/sellers/${product.seller.slug}`}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-600 dark:text-gray-400 hover:text-orange-700 dark:text-orange-300 transition-colors w-fit"
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
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-500"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  product.stock_qty > 0 ? "bg-green-500" : "bg-red-500"
                }`}
              />
              {product.stock_qty > 0
                ? t("in_stock")
                : t("out_of_stock")}
            </span>
          </div>

          {/* B2B badge */}
          {!!apiProduct.b2b_tiers?.length && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full w-fit">
              {locale === "ar" ? "متاح للجملة" : locale === "ur" ? "تھوک دستیاب" : "Wholesale available"}
            </span>
          )}

          {!!apiProduct.b2b_tiers?.length && <section><h2 className="font-semibold">{locale === "ar" ? "أسعار الجملة" : locale === "ur" ? "تھوک قیمتیں" : "Wholesale prices"}</h2><p className="text-sm my-2">{locale === "en" ? "Request a quote to confirm wholesale terms. Cart uses retail pricing." : locale === "ar" ? "اطلب عرض سعر لتأكيد شروط الجملة. السلة تستخدم سعر التجزئة." : "تھوک شرائط کے لیے نرخ طلب کریں۔ ٹوکری میں پرچون قیمت ہے۔"}</p><table className="w-full text-start text-sm"><thead><tr><th scope="col">{locale === "en" ? "Quantity" : locale === "ar" ? "الكمية" : "مقدار"}</th><th scope="col">PKR</th></tr></thead><tbody>{apiProduct.b2b_tiers.map(tier => <tr key={tier.id}><td className="py-2">{tier.min_qty}–{tier.max_qty ?? "∞"}</td><td>{tier.price_per_unit.toLocaleString("en-PK")}</td></tr>)}</tbody></table><Link className="inline-block underline py-3" href={`/${locale}/rfq/new`}>{locale === "en" ? "Request quote" : locale === "ar" ? "طلب عرض سعر" : "نرخ طلب کریں"}</Link></section>}
          {/* Add to cart */}
          <AddToCartButton product={product} />

          <ProductQr productId={apiProduct.id} />
        </div>
      </div>

      {(apiProduct.description || apiProduct.attributes) && <section className="border-t mt-10 pt-8"><h2 className="text-xl font-bold mb-4">{locale === "en" ? "Product details" : locale === "ar" ? "تفاصيل المنتج" : "مصنوعہ کی تفصیلات"}</h2><p className="whitespace-pre-wrap">{apiProduct.description}</p><dl className="mt-4 grid sm:grid-cols-2 gap-3">{Object.entries(apiProduct.attributes ?? {}).map(([key,value]) => <div key={key} className="border-b py-2"><dt className="font-semibold">{key}</dt><dd>{String(value)}</dd></div>)}</dl></section>}
      <ProductViewTracker productId={apiProduct.id} />
      {/* Reviews */}
      <ProductReviews productId={apiProduct.id} />
      <Recommendations productId={apiProduct.id} locale={locale} />
    </div>
  );
}
