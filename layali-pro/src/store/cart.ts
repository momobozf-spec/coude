"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/types";
import { trackAddToCart } from "@/lib/analytics";

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      addItem: (item) =>
        set((state) => {
          trackAddToCart({ id: item.productId, name: item.name, price: item.price, quantity: item.quantity });
          const lineKey = (i: CartItem) => `${i.productId}-${i.size || ""}-${i.color || ""}-${i.giftWrap ? "gift" : ""}`;
          const key = lineKey(item);
          const existing = state.items.find(
            (i) => lineKey(i) === key
          );
          if (existing) {
            return {
              isOpen: true,
              items: state.items.map((i) =>
                lineKey(i) === key
                  ? { ...i, quantity: Math.min(i.quantity + item.quantity, i.stock) }
                  : i
              ),
            };
          }
          return { isOpen: true, items: [...state.items, item] };
        }),
      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      updateQuantity: (id, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock)) } : i
          ),
        })),
      clearCart: () => set({ items: [] }),
      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      totalPrice: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    { name: "jj-cart" }
  )
);
