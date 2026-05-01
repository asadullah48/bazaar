"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/store/cart-store";

export function CartSidebar({ locale }: { locale: string }) {
  const t = useTranslations("cart");
  const { items, isOpen, closeCart, removeItem, updateQty, totalPrice } =
    useCartStore();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, closeCart]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        onClick={closeCart}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Drawer — slides in from the end (right in LTR, left in RTL) */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        className={`fixed top-0 end-0 z-50 h-full w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full rtl:-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-lg text-gray-900 dark:text-white">
            {t("title")}
          </h2>
          <button
            onClick={closeCart}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close cart"
          >
            <X size={20} />
          </button>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <ShoppingBag size={48} className="text-gray-200 dark:text-gray-700" />
              <p className="text-gray-500 dark:text-gray-400">{t("empty")}</p>
              <button
                onClick={closeCart}
                className="text-sm text-orange-500 hover:underline"
              >
                Continue shopping
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.product_id}
                className="flex gap-3 items-start pb-4 border-b border-gray-100 dark:border-gray-800 last:border-0"
              >
                {/* Thumbnail */}
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800 flex-shrink-0">
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 leading-snug">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.seller_name}</p>
                  <p className="text-sm font-semibold text-orange-500 mt-1">
                    {fmt(item.price)}
                  </p>

                  {/* Qty controls */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => updateQty(item.product_id, item.quantity - 1)}
                      className="w-6 h-6 rounded-md border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-sm font-medium text-gray-900 dark:text-white w-5 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQty(
                          item.product_id,
                          Math.min(item.quantity + 1, item.stock_qty)
                        )
                      }
                      disabled={item.quantity >= item.stock_qty}
                      className="w-6 h-6 rounded-md border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => removeItem(item.product_id)}
                      className="ms-auto p-1 rounded-md text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      aria-label={t("remove")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer — only shown when cart has items */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-5 space-y-4">
            <div className="flex justify-between text-base font-semibold text-gray-900 dark:text-white">
              <span>{t("total")}</span>
              <span className="text-orange-500">{fmt(totalPrice())}</span>
            </div>
            <Link
              href={`/${locale}/checkout`}
              onClick={closeCart}
              className="block w-full text-center bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              {t("checkout")}
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
