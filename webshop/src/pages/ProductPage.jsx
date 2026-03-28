import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getProductBySlug, products } from '../data/products'
import { getReviewsByProduct } from '../data/reviews'
import { useCartStore } from '../store/cartStore'
import { useLanguageStore } from '../store/languageStore'
import ProductCard from '../components/ProductCard'

export default function ProductPage() {
  const { slug } = useParams()
  const product = getProductBySlug(slug)
  const addItem = useCartStore((s) => s.addItem)
  const { t } = useLanguageStore()

  const [selectedTier, setSelectedTier] = useState('premium')
  const [quantity, setQuantity] = useState(1)
  const [mainImage, setMainImage] = useState(0)
  const [addMessage, setAddMessage] = useState(false)
  const [addWrapping, setAddWrapping] = useState(false)

  if (!product) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-sand flex items-center justify-center">
          <span className="text-3xl">?</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-brown mb-2">
          {t('productPage.notFound')}
        </h1>
        <p className="text-brown/60 mb-6">{t('productPage.notFoundDesc')}</p>
        <Link
          to="/shop"
          className="gold-gradient text-dark px-8 py-3 rounded-full font-semibold hover:shadow-lg hover:shadow-gold/25 transition-all duration-300 inline-block"
        >
          {t('common.backToShop')}
        </Link>
      </div>
    )
  }

  const productReviews = getReviewsByProduct(product.id)
  const productName =
    t(`products.${product.id}.name`) !== `products.${product.id}.name`
      ? t(`products.${product.id}.name`)
      : product.name
  const productDesc =
    t(`products.${product.id}.description`) !==
    `products.${product.id}.description`
      ? t(`products.${product.id}.description`)
      : product.description
  const productContents = (() => {
    const value = t(`products.${product.id}.contents`)
    return Array.isArray(value) ? value : product.contents || []
  })()

  const currentPrice = product.isAddOn
    ? product.price
    : product.tiers[selectedTier].price
  const addOnTotal = (addMessage ? 4.95 : 0) + (addWrapping ? 4.95 : 0)

  const relatedProducts = products
    .filter(
      (item) =>
        item.id !== product.id &&
        (item.category === product.category || !item.isAddOn)
    )
    .slice(0, 4)

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      name: productName,
      nameAr: product.nameAr,
      tier: product.isAddOn ? 'single' : selectedTier,
      tierName: product.isAddOn ? '' : product.tiers[selectedTier].name,
      price: currentPrice + addOnTotal,
      quantity,
      image: product.image,
      personalMessage: addMessage,
      giftWrapping: addWrapping,
    })
  }

  const tierOrder = ['essentials', 'premium', 'deluxe']
  const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  productReviews.forEach((review) => {
    ratingDistribution[review.rating] += 1
  })
  const maxRatingCount = Math.max(...Object.values(ratingDistribution), 1)

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <nav className="flex items-center gap-2 text-sm text-brown/50 mb-8">
        <Link to="/" className="hover:text-gold transition-colors">
          {t('nav.home')}
        </Link>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-brown/30"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <Link to="/shop" className="hover:text-gold transition-colors">
          {t('nav.shop')}
        </Link>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-brown/30"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="text-brown/80 font-medium">{productName}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 mb-20">
        <div className="lg:col-span-3">
          <div className="bg-sand rounded-3xl h-80 md:h-[28rem] flex items-center justify-center mb-5 relative overflow-hidden group">
            <span className="text-[8rem] md:text-[12rem] transition-transform duration-500 group-hover:scale-105 select-none">
              {product.gallery[mainImage]}
            </span>
            {product.badge && (
              <span className="absolute top-5 left-5 gold-gradient text-dark text-xs font-bold px-4 py-1.5 rounded-full">
                {product.badge}
              </span>
            )}
          </div>

          <div className="flex gap-3">
            {product.gallery.map((emoji, index) => (
              <button
                key={index}
                onClick={() => setMainImage(index)}
                className={`w-20 h-20 rounded-xl flex items-center justify-center text-3xl cursor-pointer transition-all duration-300 ${
                  mainImage === index
                    ? 'bg-gold/15 border-2 border-gold shadow-sm'
                    : 'bg-sand/70 border-2 border-transparent hover:border-brown/20'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-brown mb-1">
            {productName}
          </h1>
          <p className="arabic text-gold text-lg mb-4">{product.nameAr}</p>

          <div className="flex items-center gap-3 mb-4">
            <span className="text-gold text-sm">
              {'★'.repeat(Math.round(product.rating))}
              {'☆'.repeat(5 - Math.round(product.rating))}
            </span>
            <span className="text-brown/50 text-sm">
              {product.rating} ({product.reviewCount} {t('common.reviews')})
            </span>
          </div>

          {product.stock < 30 && (
            <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 text-sm font-medium px-4 py-2 rounded-full mb-4">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              {t('productPage.stockWarning', { count: product.stock })}
            </div>
          )}

          <p className="text-brown/70 mb-8 leading-relaxed text-base">
            {productDesc}
          </p>

          {!product.isAddOn && (
            <div className="mb-8">
              <h3 className="font-semibold text-brown mb-4 text-sm uppercase tracking-wider">
                {t('productPage.chooseTier')}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {tierOrder.map((key) => {
                  const tier = product.tiers[key]
                  const tierDesc = t(`products.${product.id}.tiers.${key}`)
                  const displayDesc =
                    tierDesc !== `products.${product.id}.tiers.${key}`
                      ? tierDesc
                      : tier.description

                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedTier(key)}
                      className={`p-4 rounded-xl border-2 text-left cursor-pointer transition-all duration-300 relative ${
                        selectedTier === key
                          ? 'border-gold bg-gold/5 shadow-sm'
                          : 'border-brown/10 hover:border-brown/25'
                      }`}
                    >
                      {selectedTier === key && (
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 gold-gradient rounded-full flex items-center justify-center">
                          <span className="text-dark text-xs font-bold">✓</span>
                        </div>
                      )}
                      <p className="font-semibold text-sm text-brown mb-1">
                        {tier.name}
                      </p>
                      <p className="font-heading text-xl font-bold text-brown">
                        €{tier.price.toFixed(2).replace('.', ',')}
                      </p>
                      <p className="text-brown/50 text-xs mt-1.5 leading-snug">
                        {displayDesc}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {product.isAddOn && (
            <p className="font-heading text-4xl font-bold text-brown mb-8">
              €{product.price.toFixed(2).replace('.', ',')}
            </p>
          )}

          {productContents.length > 0 && (
            <div className="mb-8">
              <h3 className="font-semibold text-brown mb-4 text-sm uppercase tracking-wider">
                {t('product.whatsInside')}
              </h3>
              <ul className="space-y-2.5">
                {productContents.map((item, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-3 text-brown/70 text-sm"
                  >
                    <span className="w-5 h-5 rounded-full bg-olive/10 text-olive text-xs flex items-center justify-center flex-shrink-0">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-4 mb-6">
            <span className="text-brown font-medium text-sm uppercase tracking-wider">
              {t('product.quantity')}
            </span>
            <div className="flex items-center border border-brown/20 rounded-full overflow-hidden">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-4 py-2.5 text-brown hover:bg-sand transition-colors cursor-pointer font-medium"
              >
                -
              </button>
              <span className="px-5 py-2.5 text-brown font-semibold min-w-[3rem] text-center bg-cream/50">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="px-4 py-2.5 text-brown hover:bg-sand transition-colors cursor-pointer font-medium"
              >
                +
              </button>
            </div>
          </div>

          <div className="space-y-3 mb-8">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={addMessage}
                onChange={() => setAddMessage(!addMessage)}
                className="w-5 h-5 accent-gold rounded"
              />
              <span className="text-brown/80 text-sm group-hover:text-brown transition-colors">
                {t('productPage.addMessageLabel')}
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={addWrapping}
                onChange={() => setAddWrapping(!addWrapping)}
                className="w-5 h-5 accent-gold rounded"
              />
              <span className="text-brown/80 text-sm group-hover:text-brown transition-colors">
                {t('productPage.addWrappingLabel')}
              </span>
            </label>
          </div>

          <button
            onClick={handleAddToCart}
            className="w-full gold-gradient text-dark py-4 rounded-full font-semibold text-lg hover:shadow-lg hover:shadow-gold/25 transition-all duration-300 cursor-pointer mb-4"
          >
            {t('common.addToCart')} - €
            {((currentPrice + addOnTotal) * quantity).toFixed(2).replace('.', ',')}
          </button>

          <div className="flex justify-center gap-6 text-brown/50 text-xs pt-3">
            <span className="flex items-center gap-1.5">
              <span className="text-olive">✓</span> {t('trust.halal')}
            </span>
            <span className="flex items-center gap-1.5">
              🚚 {t('trust.freeShipping')}
            </span>
            <span className="flex items-center gap-1.5">
              ↩ {t('trust.returns')}
            </span>
          </div>
        </div>
      </div>

      {productReviews.length > 0 && (
        <section className="mb-20">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-brown mb-8">
            {t('productPage.reviewsCount', { count: productReviews.length })}
          </h2>

          <div className="bg-white rounded-2xl p-6 shadow-sm mb-8 max-w-md">
            <h3 className="text-sm font-semibold text-brown mb-4 uppercase tracking-wider">
              {t('productPage.ratingDistribution')}
            </h3>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((star) => (
                <div key={star} className="flex items-center gap-3">
                  <span className="text-sm text-brown/70 w-8 text-right">
                    {star} ★
                  </span>
                  <div className="flex-1 h-3 bg-sand rounded-full overflow-hidden">
                    <div
                      className="h-full gold-gradient rounded-full transition-all duration-700"
                      style={{
                        width: `${
                          (ratingDistribution[star] / maxRatingCount) * 100
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-brown/40 w-6">
                    {ratingDistribution[star]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {productReviews.map((review) => (
              <div
                key={review.id}
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-gold text-sm">
                      {'★'.repeat(review.rating)}
                      {'☆'.repeat(5 - review.rating)}
                    </span>
                    {review.verified && (
                      <span className="text-olive text-xs bg-olive/10 px-2.5 py-0.5 rounded-full font-medium">
                        ✓ {t('common.verified')}
                      </span>
                    )}
                  </div>
                  <span className="text-brown/40 text-xs">{review.date}</span>
                </div>
                <p className="text-brown/80 text-sm mb-3 leading-relaxed">
                  &ldquo;{review.text}&rdquo;
                </p>
                <p className="text-brown font-semibold text-sm">{review.name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-heading text-2xl md:text-3xl font-bold text-brown mb-8">
          {t('productPage.relatedProducts')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {relatedProducts.map((item) => (
            <ProductCard key={item.id} product={item} />
          ))}
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-sand p-4 z-40 lg:hidden">
        <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
          <div>
            <p className="font-heading text-xl font-bold text-brown">
              €{((currentPrice + addOnTotal) * quantity).toFixed(2).replace('.', ',')}
            </p>
            <p className="text-brown/50 text-xs">
              {!product.isAddOn && product.tiers[selectedTier].name}
              {quantity > 1 && ` x${quantity}`}
            </p>
          </div>
          <button
            onClick={handleAddToCart}
            className="gold-gradient text-dark px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all cursor-pointer"
          >
            {t('common.addToCart')}
          </button>
        </div>
      </div>
    </div>
  )
}
