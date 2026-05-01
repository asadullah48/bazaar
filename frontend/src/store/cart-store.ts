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
            (i) => i.product_id === incoming.product_id
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.product_id === incoming.product_id
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
          return { items: [...state.items, incoming], isOpen: true };
        }),

      removeItem: (product_id) =>
        set((state) => ({
          items: state.items.filter((i) => i.product_id !== product_id),
        })),

      updateQty: (product_id, qty) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.product_id === product_id ? { ...i, quantity: qty } : i
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
