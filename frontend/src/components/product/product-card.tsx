"use client";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Product } from "@/types";
import { ProductPrice } from "./product-price";
import { Rating } from "./rating";
import { useCartStore } from "@/store/cart-store";

interface ProductCardProps {
  product: Product;
  locale: string;
}

export function ProductCard({ product, locale }: ProductCardProps) {
  const t = useTranslations("product");
  const addItem = useCartStore((s) => s.addItem);

  const primaryImage =
    product.images.find((img) => img.is_primary) ?? product.images[0];

  const isOutOfStock = product.stock_qty === 0;

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    if (isOutOfStock) return;
    addItem({
      product_id: product.id,
      name: product.name,
      slug: product.slug,
      image_url: primaryImage?.url ?? "https://placehold.co/300x300",
      price: product.price,
      quantity: 1,
      stock_qty: product.stock_qty,
      seller_name: product.seller.display_name,
    });
  }

  return (
    <Link
      href={`/${locale}/products/${product.slug}`}
      className="group relative flex flex-col rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-50 dark:bg-gray-800">
        <Image
          src={primaryImage?.url ?? "https://placehold.co/300x300"}
          alt={primaryImage?.alt ?? product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        {/* Out of stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 flex items-center justify-center">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 px-3 py-1 rounded-full shadow">
              {t("out_of_stock")}
            </span>
          </div>
        )}
        {/* Wishlist button */}
        <button
          onClick={(e) => e.preventDefault()}
          className="absolute top-2 end-2 p-1.5 rounded-full bg-white dark:bg-gray-800 shadow opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={t("add_to_wishlist")}
        >
          <Heart size={16} className="text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
          {product.seller.display_name}
        </p>
        <h3 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 leading-snug">
          {product.name}
        </h3>
        <Rating value={product.avg_rating} count={product.review_count} />
        <div className="mt-auto flex items-center justify-between gap-2">
          <ProductPrice
            price={product.price}
            comparePrice={product.compare_price}
          />
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className="p-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white disabled:text-gray-400 transition-colors flex-shrink-0"
            aria-label={t("add_to_cart")}
          >
            <ShoppingCart size={16} />
          </button>
        </div>
      </div>
    </Link>
  );
}
