import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CartItem } from "@/types";

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (product_id: string) => void;
  updateQty: (product_id: string, qty: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (incoming) =>
        set((state) => {
          const existing = state.items.find(
            (i) => (i.variant_id ?? i.product_id) === (incoming.variant_id ?? incoming.product_id)
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                (i.variant_id ?? i.product_id) === (incoming.variant_id ?? incoming.product_id)
                  ? {
                      ...i,
                      quantity: Math.min(
                        i.quantity + incoming.quantity,
                        i.stock_qty
                      ),
                    }
                  : i
              ),
              isOpen: true,
            };
          }
          if (!Number.isFinite(incoming.quantity) || incoming.quantity < 1 || incoming.stock_qty < 1) return state;
          return { items: [...state.items, {...incoming, quantity: Math.min(Math.floor(incoming.quantity), incoming.stock_qty)}], isOpen: true };
        }),

      removeItem: (product_id) =>
        set((state) => ({
          items: state.items.filter((i) => (i.variant_id ?? i.product_id) !== product_id),
        })),

      updateQty: (product_id, qty) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              (i.variant_id ?? i.product_id) === product_id ? { ...i, quantity: Number.isFinite(qty) ? Math.min(i.stock_qty, Math.max(0, Math.floor(qty))) : i.quantity } : i
            )
            .filter((i) => i.quantity > 0),
        })),

      clearCart: () => set({ items: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      totalPrice: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    {
      name: "bazaar-cart",
      partialize: (state) => ({ items: state.items }),
    }
  )
);
