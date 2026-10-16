"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Product } from "@/types";
import { ProductPrice } from "./product-price";
import { Rating } from "./rating";
import { useCartStore } from "@/store/cart-store";
import { useAuthStore } from "@/store/auth-store";
import { wishlistApi } from "@/lib/api";

interface ProductCardProps {
  product: Product;
  locale: string;
}

export function ProductCard({ product, locale }: ProductCardProps) {
  const t = useTranslations("product");
  const router = useRouter();
  const variants = product.variants?.filter(v => v.is_active) ?? [];
  const variant = variants.find(v => v.stock_qty > 0);
  const addItem = useCartStore((s) => s.addItem);
  const { accessToken } = useAuthStore();
  const [wishlisted, setWishlisted] = useState(false);

  const primaryImage =
    product.images.find((img) => img.is_primary) ?? product.images[0];

  const isOutOfStock = product.stock_qty <= 0;

  async function toggleWishlist(e: React.MouseEvent) {
    e.preventDefault();
    if (!accessToken) return;
    try {
      if (wishlisted) {
        await wishlistApi.remove(accessToken, product.id);
        setWishlisted(false);
      } else {
        await wishlistApi.add(accessToken, product.id);
        setWishlisted(true);
      }
    } catch {}
  }

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    if (isOutOfStock) return;
    if (variants.length !== 1 || !variant) { router.push(`/${locale}/products/${product.slug}`); return; }
    addItem({
      product_id: product.id,
      variant_id: variant?.id,
      name: product.name,
      slug: product.slug,
      image_url: primaryImage?.url ?? "https://placehold.co/300x300",
      price: variant?.price ?? product.price,
      quantity: 1,
      stock_qty: variant?.stock_qty ?? 0,
      seller_name: product.seller.display_name,
    });
  }

  return (
    <article
      className="group relative flex flex-col rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-brand hover:shadow-brand-hover hover:border-cyan-200 dark:hover:border-cyan-800 transition-all duration-200"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-orange-50 to-cyan-50 dark:from-gray-800 dark:to-gray-800/60">
        <Image
          src={primaryImage?.url ?? "https://placehold.co/300x300"}
          alt={primaryImage?.alt ?? product.name}
          fill
          className="object-contain group-hover:scale-105 transition-transform duration-300"
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
          onClick={toggleWishlist}
          className="absolute top-2 end-2 p-1.5 rounded-full bg-white dark:bg-gray-800 shadow opacity-100 transition-opacity"
          aria-label={t("add_to_wishlist")}
          disabled={!accessToken}
          aria-pressed={wishlisted}
        >
          <Heart size={16} className={wishlisted ? "text-red-500 fill-red-500" : "text-gray-500 dark:text-gray-600 dark:text-gray-400"} />
        </button>
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <Link
          href={`/${locale}/sellers/${product.seller.slug}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-medium text-cyan-700 dark:text-cyan-300 truncate hover:text-orange-700 dark:text-orange-300 transition-colors"
        >
          {product.seller.display_name}
        </Link>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug">
          <Link href={`/${locale}/products/${product.slug}`}>{product.name}</Link>
        </h3>
        {!!product.b2b_tiers?.length && <span className="text-xs text-cyan-800 dark:text-cyan-300">{locale === "ar" ? "أسعار الجملة" : locale === "ur" ? "تھوک قیمتیں" : "Wholesale tiers"}</span>}
        <Rating value={product.avg_rating} count={product.review_count} />
        <div className="mt-auto flex flex-col items-start gap-2">
          <ProductPrice
            price={product.price}
            comparePrice={product.compare_price}
          />
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className="flex items-center justify-center gap-2 w-full p-2 rounded-xl bg-orange-700 hover:bg-orange-800 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white disabled:text-gray-600 dark:text-gray-400 transition-colors flex-shrink-0"
            aria-label={t("add_to_cart")}
          >
            <ShoppingCart size={16} /><span className="text-xs">{t("add_to_cart")}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
