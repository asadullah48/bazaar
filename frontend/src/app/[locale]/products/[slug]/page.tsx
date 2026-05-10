import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { productsApi, ApiError } from "@/lib/api";
import { Rating } from "@/components/product/rating";
import { ProductReviews } from "@/components/product/product-reviews";
import { AddToCartButton } from "@/components/product/add-to-cart-button";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function ProductDetailPage({ params }: Props) {
  const { locale, slug } = await params;

  let product;
  try {
    product = await productsApi.get(slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const primaryImage =
    product.images.find((i) => i.is_primary) ?? product.images[0];

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Images */}
        <div className="aspect-square relative rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800">
          {primaryImage ? (
            <Image
              src={primaryImage.url}
              alt={primaryImage.alt ?? product.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
              No image
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            Sold by{" "}
            <Link
              href={`/${locale}/sellers/${product.seller.slug}`}
              className="text-orange-500 hover:underline"
            >
              {product.seller.display_name}
            </Link>
          </p>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            {product.name}
          </h1>

          {product.avg_rating !== null && (
            <div className="flex items-center gap-2 mb-4">
              <Rating value={product.avg_rating} count={product.review_count} size={16} />
            </div>
          )}

          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-3xl font-bold text-orange-500">
              {fmt(product.price)}
            </span>
            {product.compare_price && (
              <span className="text-lg text-gray-400 line-through">
                {fmt(product.compare_price)}
              </span>
            )}
          </div>

          <div className="mb-6">
            {product.stock_qty > 0 ? (
              <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                In stock ({product.stock_qty} available)
              </span>
            ) : (
              <span className="text-sm text-red-500 font-medium">Out of stock</span>
            )}
          </div>

          <AddToCartButton product={product} />
        </div>
      </div>

      {/* Reviews */}
      <ProductReviews productId={product.id} />
    </div>
  );
}
