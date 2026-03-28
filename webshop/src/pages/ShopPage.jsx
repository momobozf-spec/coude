import { useMemo } from 'react'
import { products } from '../data/products'
import { useUiStore } from '../store/uiStore'
import { useLanguageStore } from '../store/languageStore'
import ProductCard from '../components/ProductCard'

const categoryKeys = [null, 'ramadan', 'eid', 'geboorte', 'huwelijk', 'zelfzorg', 'addons']

function getPrice(p) {
  return p.isAddOn ? p.price : p.tiers.essentials.price
}

export default function ShopPage() {
  const { searchQuery, setSearchQuery, activeFilters, setFilter } = useUiStore()
  const { t } = useLanguageStore()

  const sortOptions = [
    { key: 'popular', label: t('shop.sortPopular') },
    { key: 'price-asc', label: t('shop.sortPriceLow') },
    { key: 'price-desc', label: t('shop.sortPriceHigh') },
    { key: 'rating', label: t('shop.sortRating') },
  ]

  const filtered = useMemo(() => {
    let result = [...products]

    if (activeFilters.category) {
      result = result.filter((p) => p.category === activeFilters.category)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.nameAr.includes(q) ||
          p.description.toLowerCase().includes(q)
      )
    }

    switch (activeFilters.sort) {
      case 'price-asc':
        result.sort((a, b) => getPrice(a) - getPrice(b))
        break
      case 'price-desc':
        result.sort((a, b) => getPrice(b) - getPrice(a))
        break
      case 'rating':
        result.sort((a, b) => b.rating - a.rating)
        break
      default:
        result.sort((a, b) => b.reviewCount - a.reviewCount)
    }

    return result
  }, [searchQuery, activeFilters])

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-10">
        <p className="text-gold font-medium text-sm uppercase tracking-widest mb-2">
          Collection
        </p>
        <h1 className="font-heading text-4xl md:text-5xl font-bold text-brown">
          {t('shop.title')}
        </h1>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-8">
        <div className="flex flex-col lg:flex-row gap-5 items-start lg:items-center">
          {/* Category pills */}
          <div className="flex flex-wrap gap-2 flex-1">
            {categoryKeys.map((key) => {
              const label = key === null ? t('shop.filterAll') : t(`categories.${key}`)
              return (
                <button
                  key={label}
                  onClick={() => setFilter('category', key)}
                  className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 cursor-pointer ${
                    activeFilters.category === key
                      ? 'gold-gradient text-dark shadow-md shadow-gold/20'
                      : 'bg-sand text-brown/70 hover:bg-gold/10 hover:text-brown'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Sort & Search */}
          <div className="flex gap-3 w-full lg:w-auto">
            <select
              value={activeFilters.sort}
              onChange={(e) => setFilter('sort', e.target.value)}
              className="px-4 py-2.5 rounded-full border border-brown/15 bg-cream text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 cursor-pointer transition-all"
            >
              {sortOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="relative flex-1 lg:w-56">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brown/40 pointer-events-none">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('common.search')}
                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-brown/15 bg-cream text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Result count */}
      <p className="text-brown/50 text-sm mb-6 font-medium">
        {t('shopExtra.resultCount', { count: filtered.length })}
      </p>

      {/* Product grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((product, i) => (
            <div
              key={product.id}
              className="animate-fade-in"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-sand flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brown/40">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <p className="text-brown/70 text-lg font-heading font-semibold mb-2">
            {t('shop.noProducts')}
          </p>
          <p className="text-brown/40 text-sm">
            {t('shopExtra.noResultsHint')}
          </p>
        </div>
      )}
    </div>
  )
}
