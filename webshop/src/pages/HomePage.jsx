import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { getGiftBoxes } from '../data/products'
import { categories } from '../data/categories'
import { reviews } from '../data/reviews'
import { useLanguageStore } from '../store/languageStore'
import ProductCard from '../components/ProductCard'

function useOnScreen(ref) {
  const [isVisible, setIsVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])
  return isVisible
}

export default function HomePage() {
  const { t } = useLanguageStore()
  const giftBoxes = getGiftBoxes()
  const shopCategories = categories.filter(
    (c) => c.id !== 'addons' && c.id !== 'decor'
  )
  const featuredReviews = reviews.slice(0, 4)

  const boxesRef = useRef(null)
  const boxesVisible = useOnScreen(boxesRef)
  const categoriesRef = useRef(null)
  const categoriesVisible = useOnScreen(categoriesRef)
  const reviewsRef = useRef(null)
  const reviewsVisible = useOnScreen(reviewsRef)

  const partners = [
    'Halal Quality Control',
    'Islamic Relief',
    'DHL Express',
    'Mollie Payments',
    'Thuiswinkel Waarborg',
  ]

  return (
    <div className="min-h-screen">
      {/* ─── Hero Section ─── */}
      <section className="pattern-bg bg-cream relative overflow-hidden">
        {/* Floating geometric patterns */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-20 left-10 w-24 h-24 border border-gold/20 rotate-45"
            style={{ animation: 'float 8s ease-in-out infinite' }}
          />
          <div
            className="absolute top-40 right-20 w-16 h-16 border border-gold/15 rotate-12"
            style={{ animation: 'float 6s ease-in-out infinite 1s' }}
          />
          <div
            className="absolute bottom-20 left-1/4 w-20 h-20 border border-gold/10 -rotate-12"
            style={{ animation: 'float 10s ease-in-out infinite 2s' }}
          />
          <div
            className="absolute bottom-32 right-1/3 w-12 h-12 border border-gold/20 rotate-45"
            style={{ animation: 'float 7s ease-in-out infinite 0.5s' }}
          />
        </div>

        <div className="max-w-5xl mx-auto px-4 py-24 md:py-36 text-center relative z-10">
          <p
            className="arabic text-gold text-lg md:text-xl mb-8 opacity-0"
            style={{ animation: 'heroFadeUp 0.8s ease-out 0.2s forwards' }}
          >
            {t('hero.bismillah')}
          </p>
          <h1
            className="font-heading text-5xl md:text-7xl font-bold text-brown leading-tight mb-8 opacity-0"
            style={{ animation: 'heroFadeUp 0.8s ease-out 0.4s forwards' }}
          >
            {t('hero.headline').split(',').map((part, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {i > 0 ? (
                  <span className="text-gold">{part}</span>
                ) : (
                  part + ','
                )}
              </span>
            ))}
          </h1>
          <p
            className="text-brown/70 text-lg md:text-xl max-w-2xl mx-auto mb-12 opacity-0"
            style={{ animation: 'heroFadeUp 0.8s ease-out 0.6s forwards' }}
          >
            {t('hero.subheadline')}
          </p>
          <div
            className="flex flex-col sm:flex-row gap-4 justify-center mb-12 opacity-0"
            style={{ animation: 'heroFadeUp 0.8s ease-out 0.8s forwards' }}
          >
            <Link
              to="/shop"
              className="gold-gradient text-dark px-10 py-4 rounded-full font-semibold hover:shadow-lg hover:shadow-gold/25 transition-all duration-300 text-lg"
            >
              {t('hero.cta')}
            </Link>
            <Link
              to="/over-ons"
              className="border-2 border-brown/30 text-brown px-10 py-4 rounded-full font-semibold hover:bg-brown hover:text-cream transition-all duration-300 text-lg"
            >
              {t('hero.ctaSecondary')}
            </Link>
          </div>
          <p
            className="text-brown/60 text-sm opacity-0"
            style={{ animation: 'heroFadeUp 0.8s ease-out 1s forwards' }}
          >
            {t('hero.socialProof')}
          </p>
        </div>

        <style>{`
          @keyframes heroFadeUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0) rotate(var(--tw-rotate, 45deg)); }
            50% { transform: translateY(-15px) rotate(var(--tw-rotate, 45deg)); }
          }
        `}</style>
      </section>

      {/* ─── Trust Bar ─── */}
      <section className="bg-olive text-white py-5">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap justify-center gap-x-10 gap-y-3 text-sm md:text-base">
          {[
            { icon: '✓', text: t('trust.halal') },
            { icon: '🎁', text: t('trust.giftWrap') },
            { icon: '🚚', text: t('trust.freeShipping') },
            { icon: '↩️', text: t('trust.returns') },
          ].map((item) => (
            <span
              key={item.text}
              className="flex items-center gap-2 hover:scale-105 transition-transform duration-200 cursor-default"
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium">{item.text}</span>
            </span>
          ))}
        </div>
      </section>

      {/* ─── Signature Boxes ─── */}
      <section ref={boxesRef} className="max-w-6xl mx-auto px-4 py-20 md:py-28">
        <div className="text-center mb-14">
          <p className="text-gold font-medium text-sm uppercase tracking-widest mb-3">
            Collection
          </p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-brown">
            {t('sections.signatureBoxes')}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {giftBoxes.map((product, i) => (
            <div
              key={product.id}
              className={`transition-all duration-700 ${
                boxesVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
        <div className="text-center mt-12">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 text-gold font-semibold hover:gap-4 transition-all duration-300 text-lg group"
          >
            {t('sections.viewAllProducts')}
            <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
          </Link>
        </div>
      </section>

      {/* ─── Shop op Gelegenheid ─── */}
      <section ref={categoriesRef} className="bg-sand py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-gold font-medium text-sm uppercase tracking-widest mb-3">
              Categories
            </p>
            <h2 className="font-heading text-3xl md:text-5xl font-bold text-brown">
              {t('sections.shopByOccasion')}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {shopCategories.map((cat, i) => (
              <Link
                key={cat.id}
                to={`/collections/${cat.slug}`}
                className={`group relative bg-white rounded-2xl p-8 text-center overflow-hidden hover:shadow-xl transition-all duration-500 ${
                  categoriesVisible
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10">
                  <span className="text-5xl block mb-5 group-hover:scale-125 transition-transform duration-500">
                    {cat.icon}
                  </span>
                  <h3 className="font-heading text-xl font-semibold text-brown mb-1">
                    {t(`categories.${cat.id}`)}
                  </h3>
                  <p className="arabic text-gold text-sm mb-4">{cat.nameAr}</p>
                  <p className="text-brown/60 text-sm leading-relaxed">
                    {t(`categoryDescriptions.${cat.id}`)}
                  </p>
                  <span className="inline-block mt-4 text-gold text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                    {t('common.viewAll')} &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Reviews ─── */}
      <section ref={reviewsRef} className="max-w-6xl mx-auto px-4 py-20 md:py-28">
        <div className="text-center mb-14">
          <p className="text-gold font-medium text-sm uppercase tracking-widest mb-3">
            Testimonials
          </p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-brown">
            {t('sections.customerReviews')}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredReviews.map((review, i) => (
            <div
              key={review.id}
              className={`bg-white rounded-2xl p-7 shadow-sm hover:shadow-md transition-all duration-500 ${
                reviewsVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="text-gold/30 text-5xl font-heading leading-none mb-2">
                &ldquo;
              </div>
              <div className="text-gold mb-3 text-sm">
                {'★'.repeat(review.rating)}
                {'☆'.repeat(5 - review.rating)}
              </div>
              <p className="text-brown/80 text-sm mb-5 leading-relaxed line-clamp-4">
                {review.text}
              </p>
              <div className="border-t border-sand pt-4">
                <p className="font-semibold text-brown text-sm">
                  {review.name}
                </p>
                {review.verified && (
                  <span className="text-olive text-xs flex items-center gap-1 mt-1">
                    ✓ {t('common.verified')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Partners Strip ─── */}
      <section className="bg-sand/50 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-center text-brown/40 text-sm uppercase tracking-widest mb-8 font-medium">
            {t('partners.title')}
          </p>
          <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-4">
            {partners.map((name) => (
              <span
                key={name}
                className="text-brown/30 font-heading text-lg md:text-xl font-bold hover:text-brown/50 transition-colors duration-300 cursor-default"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Newsletter ─── */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0 pattern-bg bg-cream" />
        {/* Gold accent lines */}
        <div className="absolute top-0 left-0 w-full h-1 gold-gradient" />
        <div className="absolute bottom-0 left-0 w-full h-1 gold-gradient" />

        <div className="max-w-xl mx-auto px-4 text-center relative z-10">
          <div className="inline-block mb-6">
            <div className="w-12 h-12 border-2 border-gold/30 rotate-45 mx-auto flex items-center justify-center">
              <div className="w-6 h-6 border border-gold/50 rotate-0" />
            </div>
          </div>
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-brown mb-5">
            {t('newsletter.heading')}
          </h2>
          <p className="text-brown/70 mb-10 text-lg">
            {t('newsletter.subheading')}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              alert(t('footer.subscribed'))
            }}
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <input
              type="email"
              placeholder={t('newsletter.placeholder')}
              required
              className="flex-1 px-5 py-4 rounded-full border border-brown/20 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 bg-white text-brown transition-all"
            />
            <button
              type="submit"
              className="gold-gradient text-dark px-8 py-4 rounded-full font-semibold hover:shadow-lg hover:shadow-gold/25 transition-all duration-300 cursor-pointer whitespace-nowrap"
            >
              {t('newsletter.button')}
            </button>
          </form>
          <p className="text-brown/40 text-xs mt-5">
            {t('newsletter.privacy')}
          </p>
        </div>
      </section>
    </div>
  )
}
