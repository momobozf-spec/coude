import { useMemo } from 'react'
import { products } from '../data/products'
import { useUiStore } from '../store/uiStore'
import { useLanguageStore } from '../store/languageStore'
import ProductCard from '../components/ProductCard'

const categoryKeys = [
  null,
  'ramadan',
  'eid',
  'geboorte',
  'huwelijk',
  'zelfzorg',
  'addons',
]

function getPrice(product) {
  return product.isAddOn ? product.price : product.tiers.essentials.price
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
      result = result.filter((product) => product.category === activeFilters.category)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.nameAr.includes(query) ||
          product.description.toLowerCase().includes(query)
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
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <section className="relative overflow-hidden rounded-[2.2rem] border border-gold/12 ink-gradient px-6 py-8 text-cream shadow-[0_28px_90px_rgba(28,23,20,0.18)] md:px-10 md:py-12">
        <div className="absolute inset-0 opacity-20 pattern-bg" />
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-gold/16 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-olive/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.3em] text-gold/90">
              Curated storefront
            </p>
            <h1 className="mt-4 font-heading text-4xl leading-none text-cream md:text-6xl">
              {t('shop.title')}
            </h1>
            <p className="mt-5 text-base leading-8 text-cream/68">
              Een premium collectiepagina die werkt voor klanten in Nederland,
              Belgie, Frankrijk en Duitsland door rust, vertrouwen en gifting
              duidelijkheid centraal te zetten.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'European feel', value: 'Multi-market ready' },
              { label: 'Premium look', value: 'Luxury gift-first' },
              { label: 'Fast browse', value: `${filtered.length} results` },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[1.3rem] border border-white/12 bg-white/7 px-4 py-4 backdrop-blur"
              >
                <p className="text-[11px] uppercase tracking-[0.24em] text-gold/75">
                  {item.label}
                </p>
                <p className="mt-2 text-sm font-medium text-cream/88">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 shell-card rounded-[2rem] p-5 md:p-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2.5">
              {categoryKeys.map((key) => {
                const label = key === null ? t('shop.filterAll') : t(`categories.${key}`)
                const active = activeFilters.category === key

                return (
                  <button
                    key={label}
                    onClick={() => setFilter('category', key)}
                    className={`rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300 ${
                      active
                        ? 'gold-gradient text-dark shadow-[0_12px_26px_rgba(198,168,108,0.28)]'
                        : 'border border-gold/10 bg-white/72 text-brown/70 hover:border-gold/25 hover:bg-gold/8 hover:text-brown'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            <div className="grid gap-3 md:grid-cols-[190px_minmax(0,260px)]">
              <select
                value={activeFilters.sort}
                onChange={(event) => setFilter('sort', event.target.value)}
                className="gold-outline rounded-full bg-cream/70 px-4 py-3 text-sm text-brown outline-none transition-all focus:border-gold focus:ring-2 focus:ring-gold/18"
              >
                {sortOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brown/35">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t('common.search')}
                  className="gold-outline w-full rounded-full bg-cream/70 py-3 pl-11 pr-4 text-sm text-brown outline-none transition-all focus:border-gold focus:ring-2 focus:ring-gold/18"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-gold/10 pt-4 text-sm text-brown/55 md:flex-row md:items-center md:justify-between">
            <p className="font-medium">{t('shopExtra.resultCount', { count: filtered.length })}</p>
            <p className="text-xs uppercase tracking-[0.24em] text-brown/35">
              premium gifting, occasion-led navigation, international appeal
            </p>
          </div>
        </div>
      </section>

      {filtered.length > 0 ? (
        <section className="mt-10 grid grid-cols-1 gap-7 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product, index) => (
            <div
              key={product.id}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 70}ms`, animationFillMode: 'both' }}
            >
              <ProductCard product={product} />
            </div>
          ))}
        </section>
      ) : (
        <div className="shell-card mt-10 rounded-[2rem] py-20 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sand text-brown/35">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <p className="mt-6 font-heading text-2xl text-brown">{t('shop.noProducts')}</p>
          <p className="mt-3 text-sm text-brown/42">{t('shopExtra.noResultsHint')}</p>
        </div>
      )}
    </div>
  )
}
