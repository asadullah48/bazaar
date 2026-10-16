"use client";
import { useState } from "react";
import { ShoppingCart, Minus, Plus } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { ProductPrice } from "./product-price";
import { Product } from "@/types";
import { useCartStore } from "@/store/cart-store";

export function AddToCartButton({ product }: { product: Product }) {
  const t = useTranslations("product");
  const addItem = useCartStore((s) => s.addItem);
  const [qty, setQty] = useState(1);
  const variants = product.variants?.filter(v => v.is_active) ?? [];
  const [variantId, setVariantId] = useState(variants.find(v => v.stock_qty > 0)?.id ?? variants[0]?.id ?? "");
  const variant = variants.find(v => v.id === variantId);
  const stock = variant?.stock_qty ?? 0;
  const isOutOfStock = stock <= 0;
  const locale = useLocale();

  const primaryImage =
    product.images.find((img) => img.is_primary) ?? product.images[0];

  function handleAdd() {
    if (!variant || isOutOfStock) return;
    addItem({
      product_id: product.id,
      variant_id: variant?.id,
      name: product.name,
      slug: product.slug,
      image_url: primaryImage?.url ?? "https://placehold.co/300x300",
      price: variant?.price ?? product.price,
      quantity: qty,
      stock_qty: stock,
      seller_name: product.seller.display_name,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {variants.length > 1 && <label>{locale === "ar" ? "الخيار" : locale === "ur" ? "انتخاب" : "Choose an option"}<select className="market-input" value={variantId} onChange={e => {setVariantId(e.target.value);setQty(1);}}>{variants.map(v => <option key={v.id} value={v.id} disabled={v.stock_qty <= 0}>{v.sku_code ?? v.id} · PKR {v.price.toLocaleString("en-PK")}</option>)}</select></label>}
      {variant && variants.length > 1 && <ProductPrice price={variant.price}/>}

      {/* Qty selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("quantity")}
        </span>
        <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <button
            aria-label={t("quantity") + " −"}
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            className="px-3 py-2 text-gray-600 dark:text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            <Minus size={14} />
          </button>
          <span className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white min-w-[2.5rem] text-center">
            {qty}
          </span>
          <button
            aria-label={t("quantity") + " +"}
            onClick={() => setQty((q) => Math.min(stock, q + 1))}
            disabled={qty >= stock}
            className="px-3 py-2 text-gray-600 dark:text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Add to cart */}
      <button
        onClick={handleAdd}
        disabled={isOutOfStock}
        className="flex items-center justify-center gap-2 bg-orange-700 hover:bg-orange-800 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white disabled:text-gray-600 dark:text-gray-400 font-semibold py-3 px-6 rounded-xl transition-colors text-sm"
      >
        <ShoppingCart size={18} />
        {isOutOfStock ? t("out_of_stock") : t("add_to_cart")}
      </button>
    </div>
  );
}
