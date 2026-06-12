"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Currency, Language, Product, WishlistItem } from "@/types";

interface CartState {
  items: CartItem[];
  isDrawerOpen: boolean;
  add: (product: Product, qty?: number) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  count: () => number;
  subtotal: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isDrawerOpen: false,
      add: (product, qty = 1) => {
        const items = [...get().items];
        const idx = items.findIndex((i) => i.product.id === product.id);
        if (idx >= 0) {
          items[idx] = { ...items[idx], quantity: items[idx].quantity + qty };
        } else {
          items.push({ product, quantity: qty });
        }
        set({ items, isDrawerOpen: true });
      },
      remove: (productId) =>
        set({ items: get().items.filter((i) => i.product.id !== productId) }),
      setQty: (productId, qty) => {
        if (qty <= 0) {
          set({ items: get().items.filter((i) => i.product.id !== productId) });
          return;
        }
        set({
          items: get().items.map((i) =>
            i.product.id === productId ? { ...i, quantity: qty } : i,
          ),
        });
      },
      clear: () => set({ items: [] }),
      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      count: () => get().items.reduce((s, i) => s + i.quantity, 0),
      subtotal: () =>
        get().items.reduce((s, i) => s + i.product.price * i.quantity, 0),
    }),
    {
      name: "eid-luxe-cart",
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

interface WishlistState {
  items: WishlistItem[];
  toggle: (productId: string) => void;
  has: (productId: string) => boolean;
  clear: () => void;
  count: () => number;
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (productId) => {
        const items = [...get().items];
        const idx = items.findIndex((i) => i.productId === productId);
        if (idx >= 0) items.splice(idx, 1);
        else items.push({ productId, addedAt: Date.now() });
        set({ items });
      },
      has: (productId) =>
        Boolean(get().items.find((i) => i.productId === productId)),
      clear: () => set({ items: [] }),
      count: () => get().items.length,
    }),
    {
      name: "eid-luxe-wishlist",
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

interface PreferencesState {
  currency: Currency;
  language: Language;
  setCurrency: (c: Currency) => void;
  setLanguage: (l: Language) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      currency: "EUR",
      language: "nl",
      setCurrency: (c) => set({ currency: c }),
      setLanguage: (l) => set({ language: l }),
    }),
    { name: "eid-luxe-prefs" },
  ),
);

interface ToastState {
  message: string | null;
  show: (msg: string) => void;
  hide: () => void;
}

export const useToast = create<ToastState>()((set) => ({
  message: null,
  show: (msg) => {
    set({ message: msg });
    if (typeof window !== "undefined") {
      window.setTimeout(() => set({ message: null }), 2200);
    }
  },
  hide: () => set({ message: null }),
}));
