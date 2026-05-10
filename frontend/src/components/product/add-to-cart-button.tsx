"use client";
import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { ApiProduct } from "@/lib/api";

export function AddToCartButton({ product }: { product: ApiProduct }) {
  const { addItem } = useCartStore();
  const [added, setAdded] = useState(false);

  if (product.stock_qty === 0) {
    return (
      <button
        disabled
        className="w-full py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-400 font-semibold cursor-not-allowed"
      >
        Out of Stock
      </button>
    );
  }

  function handleAdd() {
    const primaryImg =
      product.images.find((i) => i.is_primary) ?? product.images[0];
    addItem({
      product_id: product.id,
      name: product.name,
      slug: product.slug,
      image_url: primaryImg?.url ?? "",
      price: product.price,
      quantity: 1,
      stock_qty: product.stock_qty,
      seller_name: product.seller.display_name,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <button
      onClick={handleAdd}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-colors"
    >
      {added ? (
        <>
          <Check size={18} />
          Added!
        </>
      ) : (
        <>
          <ShoppingCart size={18} />
          Add to Cart
        </>
      )}
    </button>
  );
}
