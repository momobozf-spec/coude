import { Link } from 'react-router-dom'
import { useCartStore } from '../store/cartStore'
import { useWishlistStore } from '../store/wishlistStore'
import { useLanguageStore } from '../store/languageStore'

export default function ProductCard({ product }) {
  const addItem = useCartStore((s) => s.addItem)
  const toggleWishlist = useWishlistStore((s) => s.toggleWishlist)
  const isWishlisted = useWishlistStore((s) => s.isWishlisted(product.id))
  const { t } = useLanguageStore()

  const productName = t(`products.${product.id}.name`) !== `products.${product.id}.name`
    ? t(`products.${product.id}.name`)
    : product.name

  const handleAddToCart = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (product.isAddOn) {
      addItem({
        id: product.id,
        name: productName,
        price: product.price,
        image: product.image,
        tier: 'single',
        tierName: '',
      })
    } else {
      const essentials = product.tiers?.essentials
      if (essentials) {
        addItem({
          id: product.id,
          name: productName,
          price: essentials.price,
          image: product.image,
          tier: 'essentials',
          tierName: essentials.name,
        })
      }
    }
  }

  const handleWishlistToggle = (e) => {
    e.preventDefault()
    e.stopPropagation()
    toggleWishlist(product.id)
  }

  const getPrice = () => {
    if (product.isAddOn) {
      return `\u20AC${product.price.toFixed(2).replace('.', ',')}`
    }
    const essentials = product.tiers?.essentials
    if (essentials) {
      return `${t('product.from')} \u20AC${essentials.price.toFixed(2).replace('.', ',')}`
    }
    return ''
  }

  const getBadgeStyle = (badge) => {
    if (!badge) return ''
    const lower = badge.toLowerCase()
    if (lower === 'bestseller' || lower === 'best-seller') {
      return 'bg-gradient-to-r from-gold to-gold/80 text-dark'
    }
    if (lower === 'populair' || lower === 'popular' || lower === 'populaire' || lower === 'beliebt') {
      return 'bg-olive text-white'
    }
    if (lower === 'nieuw' || lower === 'new' || lower === 'nouveau' || lower === 'neu') {
      return 'bg-brown text-cream'
    }
    return 'bg-gradient-to-r from-gold to-gold/80 text-dark'
  }

  const getTranslatedBadge = (badge) => {
    if (!badge) return null
    const lower = badge.toLowerCase()
    if (lower === 'bestseller') return t('product.bestseller')
    if (lower === 'populair') return t('product.popular')
    return badge
  }

  const renderStars = (rating) => {
    const stars = []
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span
          key={i}
          className={`text-sm ${i <= Math.round(rating) ? 'text-gold' : 'text-sand'}`}
        >
          {'\u2605'}
        </span>
      )
    }
    return stars
  }

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group relative block rounded-2xl bg-white shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden border border-sand/40 hover:border-gold/20"
    >
      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      {/* Image area */}
      <div className="relative bg-gradient-to-b from-sand/30 to-sand/50 p-6 flex items-center justify-center overflow-hidden">
        <span className="text-[6rem] leading-none select-none group-hover:scale-110 transition-transform duration-500 ease-out">
          {product.image}
        </span>

        {/* Badge */}
        {product.badge && (
          <span
            className={`absolute top-3 left-3 rounded-full px-3.5 py-1 text-xs font-semibold shadow-sm ${getBadgeStyle(product.badge)}`}
          >
            {getTranslatedBadge(product.badge)}
          </span>
        )}

        {/* Wishlist heart */}
        <button
          onClick={handleWishlistToggle}
          className={`absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300 hover:scale-110 ${
            isWishlisted
              ? 'text-red-500 shadow-red-100'
              : 'text-brown/30 hover:text-red-400'
          }`}
          aria-label={isWishlisted ? t('product.removeFromWishlist') : t('product.addToWishlist')}
        >
          <svg
            className={`h-5 w-5 transition-transform duration-300 ${isWishlisted ? 'scale-110' : 'group-hover:scale-105'}`}
            fill={isWishlisted ? 'currentColor' : 'none'}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={isWishlisted ? 0 : 1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 pt-3.5">
        <h3 className="font-heading text-lg font-semibold text-brown leading-tight group-hover:text-gold transition-colors duration-300">
          {productName}
        </h3>
        {product.nameAr && (
          <p className="font-arabic text-sm text-brown/40 mt-0.5" dir="rtl">
            {product.nameAr}
          </p>
        )}

        {/* Rating */}
        <div className="flex items-center gap-1.5 mt-2">
          <div className="flex">{renderStars(product.rating)}</div>
          <span className="text-xs text-brown/40 font-medium">({product.reviewCount})</span>
        </div>

        {/* Price */}
        <p className="mt-2.5 text-lg font-bold text-gold">{getPrice()}</p>

        {/* Variants hint */}
        {!product.isAddOn && product.tiers && (
          <p className="text-xs text-brown/40 mt-1">{t('product.variantsAvailable')}</p>
        )}

        {/* Add to cart button */}
        <button
          onClick={handleAddToCart}
          className="mt-3 w-full rounded-xl bg-olive py-2.5 text-sm font-semibold text-white hover:bg-olive/85 transition-all duration-300 active:scale-[0.97] shadow-sm hover:shadow-md"
        >
          {t('product.addToCart')}
        </button>
      </div>
    </Link>
  )
}
