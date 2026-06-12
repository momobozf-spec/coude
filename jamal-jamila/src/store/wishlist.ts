"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Client-side wishlist (favorites). Persists to localStorage so it works for
 * guests without touching the backend. The authenticated /account/wishlist page
 * keeps its own server-backed list; this store powers the heart toggles in the
 * product grid and cards for instant, no-login feedback.
 */
interface WishlistStore {
  ids: string[];
  toggle: (id: string) => void;
  has: (id: string) => boolean;
  count: () => number;
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) =>
        set((state) => ({
          ids: state.ids.includes(id)
            ? state.ids.filter((i) => i !== id)
            : [...state.ids, id],
        })),
      has: (id) => get().ids.includes(id),
      count: () => get().ids.length,
    }),
    { name: "layali-wishlist" }
  )
);
