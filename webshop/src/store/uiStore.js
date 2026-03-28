import { create } from 'zustand'

export const useUiStore = create((set) => ({
  isCartOpen: false,
  isMenuOpen: false,
  isMobileNavVisible: false,
  searchQuery: '',
  activeFilters: { category: null, sort: 'popular' },

  openCart: () => set({ isCartOpen: true }),
  closeCart: () => set({ isCartOpen: false }),
  toggleCart: () => set((state) => ({ isCartOpen: !state.isCartOpen })),

  openMenu: () => set({ isMenuOpen: true }),
  closeMenu: () => set({ isMenuOpen: false }),
  toggleMenu: () => set((state) => ({ isMenuOpen: !state.isMenuOpen })),

  toggleMobileNav: () =>
    set((state) => ({ isMobileNavVisible: !state.isMobileNavVisible })),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setFilter: (key, value) =>
    set((state) => ({
      activeFilters: { ...state.activeFilters, [key]: value },
    })),

  resetFilters: () =>
    set({ activeFilters: { category: null, sort: 'popular' } }),
}))
