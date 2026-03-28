import { create } from 'zustand'

export const useWishlistStore = create((set, get) => ({
  items: [],

  toggleWishlist: (productId) =>
    set((state) => {
      if (state.items.includes(productId)) {
        return { items: state.items.filter((id) => id !== productId) }
      }
      return { items: [...state.items, productId] }
    }),

  isWishlisted: (productId) => {
    return get().items.includes(productId)
  },
}))
