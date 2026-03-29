import { Link } from 'react-router-dom'
import { useCartStore } from '../store/cartStore'
import { useWishlistStore } from '../store/wishlistStore'
import { useLanguageStore } from '../store/languageStore'

export default function ProductCard({ product }) {
  const addItem = useCartStore((s) => s.addItem)
  const toggleWishlist = useWishlistStore((s) => s.toggleWishlist)
  const isWishlisted = useWishlistStore((s) => s.isWishlisted(product.id))
  const { t } = useLanguageStore()

  const productName =
    t(`products.${product.id}.name`) !== `products.${product.id}.name`
      ? t(`products.${product.id}.name`)
      : product.name

  const handleAddToCart = (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (product.isAddOn) {
      addItem({
        id: product.id,
        name: productName,
        price: product.price,
        image: product.image,
        tier: 'single',
        tierName: '',
      })
      return
    }

    const essentials = product.tiers?.essentials
    if (!essentials) return

    addItem({
      id: product.id,
      name: productName,
      price: essentials.price,
      image: product.image,
      tier: 'essentials',
      tierName: essentials.name,
    })
  }

  const handleWishlistToggle = (event) => {
    event.preventDefault()
    event.stopPropagation()
    toggleWishlist(product.id)
  }

  const priceLabel = product.isAddOn
    ? `\u20AC${product.price.toFixed(2).replace('.', ',')}`
    : `${t('product.from')} \u20AC${product.tiers.essentials.price
        .toFixed(2)
        .replace('.', ',')}`

  const getBadgeStyle = (badge) => {
    if (!badge) return ''

    const lower = badge.toLowerCase()
    if (lower.includes('best')) {
      return 'bg-gradient-to-r from-gold via-[#e3c98f] to-gold text-dark'
    }
    if (lower.includes('pop') || lower.includes('beliebt')) {
      return 'bg-olive text-white'
    }
    if (lower.includes('new') || lower.includes('nieuw') || lower.includes('nouveau')) {
      return 'bg-brown text-cream'
    }
    return 'bg-dark text-cream'
  }

  const getTranslatedBadge = (badge) => {
    if (!badge) return null
    const lower = badge.toLowerCase()
    if (lower === 'bestseller') return t('product.bestseller')
    if (lower === 'populair') return t('product.popular')
    return badge
  }

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group relative block overflow-hidden rounded-[2rem] border border-gold/15 bg-white/80 shadow-[0_18px_60px_rgba(44,36,32,0.08)] transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_28px_90px_rgba(44,36,32,0.16)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(198,168,108,0.16),transparent_48%)] opacity-70" />
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

      <div className="relative p-5">
        <div className="relative overflow-hidden rounded-[1.6rem] border border-white/60 bg-gradient-to-br from-sand via-[#f5ede1] to-[#efe4d2] px-4 pb-8 pt-5">
          <div className="absolute inset-0 soft-grid opacity-35" />
          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-gold/15 blur-2xl" />
          <div className="absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-olive/10 blur-2xl" />

          {product.badge && (
            <span
              className={`absolute left-4 top-4 z-10 rounded-full px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] shadow-sm ${getBadgeStyle(product.badge)}`}
            >
              {getTranslatedBadge(product.badge)}
            </span>
          )}

          <button
            onClick={handleWishlistToggle}
            className={`absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/85 shadow-sm backdrop-blur-sm transition-all duration-300 hover:scale-110 ${
              isWishlisted
                ? 'text-red-500 shadow-red-100'
                : 'text-brown/35 hover:text-red-400'
            }`}
            aria-label={
              isWishlisted
                ? t('product.removeFromWishlist')
                : t('product.addToWishlist')
            }
          >
            <svg
              className="h-5 w-5"
              fill={isWishlisted ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={isWishlisted ? 0 : 1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
          </button>

          <div className="relative flex min-h-[15rem] items-center justify-center">
            <span className="select-none text-[6.5rem] leading-none transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3">
              {product.image}
            </span>
          </div>

          {!product.isAddOn && (
            <div className="relative z-10 mx-auto flex max-w-max items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-1.5 text-[11px] font-medium text-brown/65 shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-olive" />
              <span>{product.stock} stuks beschikbaar</span>
            </div>
          )}
        </div>

        <div className="relative pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.26em] text-brown/35">
                Jamal &amp; Jamila
              </p>
              <h3 className="font-heading text-[1.45rem] leading-tight text-brown transition-colors duration-300 group-hover:text-gold">
                {productName}
              </h3>
            </div>
            <div className="rounded-full border border-gold/15 bg-gold/8 px-3 py-1 text-xs font-semibold text-gold">
              {product.rating.toFixed(1)}
            </div>
          </div>

          {product.nameAr && (
            <p className="font-arabic text-sm text-brown/45" dir="rtl">
              {product.nameAr}
            </p>
          )}

          <div className="mt-4 flex items-center gap-2 text-sm text-gold">
            <span>{'★'.repeat(Math.round(product.rating))}</span>
            <span className="text-xs font-medium text-brown/40">
              ({product.reviewCount})
            </span>
          </div>

          <p className="mt-4 text-lg font-semibold text-brown">
            <span className="text-gold">{priceLabel}</span>
          </p>

          {!product.isAddOn && product.tiers && (
            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-brown/35">
              {t('product.variantsAvailable')}
            </p>
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              onClick={handleAddToCart}
              className="gold-gradient flex-1 rounded-full px-5 py-3 text-sm font-semibold text-dark shadow-[0_14px_30px_rgba(198,168,108,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(198,168,108,0.35)]"
            >
              {t('product.addToCart')}
            </button>
            <span className="rounded-full border border-brown/10 bg-sand/60 px-3 py-2 text-xs font-medium text-brown/60">
              {product.isAddOn ? 'Add-on' : 'Signature'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
