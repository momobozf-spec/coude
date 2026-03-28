import { create } from 'zustand'

export const FREE_SHIPPING_THRESHOLD = 59
export const CART_UPSELL_PRICE = 4.95

export const useCartStore = create((set, get) => ({
  items: [],
  cartExtras: {
    giftWrapping: false,
    handwrittenCard: false,
  },

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find(
        (current) => current.id === item.id && current.tier === item.tier
      )

      if (existing) {
        return {
          items: state.items.map((current) =>
            current.id === item.id && current.tier === item.tier
              ? { ...current, quantity: current.quantity + (item.quantity || 1) }
              : current
          ),
        }
      }

      return {
        items: [
          ...state.items,
          {
            ...item,
            quantity: item.quantity || 1,
            tierName: item.tierName || '',
            personalMessage: item.personalMessage || false,
            giftWrapping: item.giftWrapping || false,
          },
        ],
      }
    }),

  removeItem: (id, tier) =>
    set((state) => ({
      items: state.items.filter(
        (item) => !(item.id === id && item.tier === tier)
      ),
    })),

  updateQuantity: (id, tier, quantity) =>
    set((state) => {
      if (quantity <= 0) {
        return {
          items: state.items.filter(
            (item) => !(item.id === id && item.tier === tier)
          ),
        }
      }

      return {
        items: state.items.map((item) =>
          item.id === id && item.tier === tier ? { ...item, quantity } : item
        ),
      }
    }),

  toggleCartExtra: (key) =>
    set((state) => ({
      cartExtras: {
        ...state.cartExtras,
        [key]: !state.cartExtras[key],
      },
    })),

  clearCart: () =>
    set({
      items: [],
      cartExtras: {
        giftWrapping: false,
        handwrittenCard: false,
      },
    }),

  getSubtotal: () => {
    const { items } = get()
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  },

  getExtrasTotal: () => {
    const { cartExtras } = get()
    return Object.values(cartExtras).filter(Boolean).length * CART_UPSELL_PRICE
  },

  getTotal: () => get().getSubtotal() + get().getExtrasTotal(),

  getItemCount: () => {
    const { items } = get()
    return items.reduce((sum, item) => sum + item.quantity, 0)
  },
}))
