"use client";
import { useState } from "react";
import { ShoppingCart, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Product } from "@/types";
import { useCartStore } from "@/store/cart-store";

export function AddToCartButton({ product }: { product: Product }) {
  const t = useTranslations("product");
  const addItem = useCartStore((s) => s.addItem);
  const [qty, setQty] = useState(1);
  const isOutOfStock = product.stock_qty === 0;

  const primaryImage =
    product.images.find((img) => img.is_primary) ?? product.images[0];

  function handleAdd() {
    addItem({
      product_id: product.id,
      name: product.name,
      slug: product.slug,
      image_url: primaryImage?.url ?? "https://placehold.co/300x300",
      price: product.price,
      quantity: qty,
      stock_qty: product.stock_qty,
      seller_name: product.seller.display_name,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Qty selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("quantity")}
        </span>
        <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            <Minus size={14} />
          </button>
          <span className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white min-w-[2.5rem] text-center">
            {qty}
          </span>
          <button
            onClick={() => setQty((q) => Math.min(product.stock_qty, q + 1))}
            disabled={qty >= product.stock_qty}
            className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Add to cart */}
      <button
        onClick={handleAdd}
        disabled={isOutOfStock}
        className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white disabled:text-gray-400 font-semibold py-3 px-6 rounded-xl transition-colors text-sm"
      >
        <ShoppingCart size={18} />
        {isOutOfStock ? t("out_of_stock") : t("add_to_cart")}
      </button>
    </div>
  );
}
