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
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true)
      },
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
    (category) => category.id !== 'addons' && category.id !== 'decor'
  )
  const featuredReviews = reviews.slice(0, 4)

  const boxesRef = useRef(null)
  const boxesVisible = useOnScreen(boxesRef)
  const categoriesRef = useRef(null)
  const categoriesVisible = useOnScreen(categoriesRef)
  const reviewsRef = useRef(null)
  const reviewsVisible = useOnScreen(reviewsRef)

  const partners = [
    'Mollie',
    'Bancontact',
    'PostNL Ready',
    'Klaviyo Ready',
    'Shopify API Ready',
  ]

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden px-4 pb-8 pt-8 md:px-6 md:pt-10">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-[8%] top-16 h-44 w-44 rounded-full bg-gold/12 blur-3xl" />
          <div className="absolute right-[8%] top-28 h-52 w-52 rounded-full bg-olive/10 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_top,rgba(198,168,108,0.14),transparent_55%)]" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
          <div className="ink-gradient relative overflow-hidden rounded-[2rem] px-6 py-8 text-cream shadow-[0_30px_100px_rgba(28,23,20,0.22)] md:px-10 md:py-12">
            <div className="absolute inset-0 opacity-20 pattern-bg" />
            <div className="absolute -right-20 top-10 h-52 w-52 rounded-full bg-gold/20 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-56 w-56 rounded-full bg-olive/10 blur-3xl" />

            <div className="relative z-10 max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-white/6 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.28em] text-gold/90">
                <span className="h-2 w-2 rounded-full bg-gold" />
                Premium Islamic gifting for Europe
              </span>

              <p className="arabic mt-8 text-lg text-gold md:text-xl">
                {t('hero.bismillah')}
              </p>

              <h1 className="mt-6 font-heading text-5xl leading-[0.95] text-cream md:text-7xl">
                {t('hero.headline')}
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-cream/72 md:text-lg">
                {t('hero.subheadline')}
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  to="/shop"
                  className="gold-gradient rounded-full px-8 py-4 text-center text-base font-semibold text-dark shadow-[0_18px_35px_rgba(198,168,108,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_45px_rgba(198,168,108,0.45)]"
                >
                  {t('hero.cta')}
                </Link>
                <Link
                  to="/over-ons"
                  className="rounded-full border border-white/18 bg-white/8 px-8 py-4 text-center text-base font-semibold text-cream transition-all duration-300 hover:bg-white/12"
                >
                  {t('hero.ctaSecondary')}
                </Link>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  'NL / BE focus',
                  'FR / DE friendly',
                  'Luxury gift appeal',
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-[1.4rem] border border-white/12 bg-white/8 px-4 py-4 backdrop-blur"
                  >
                    <p className="text-[11px] uppercase tracking-[0.24em] text-gold/80">
                      Market
                    </p>
                    <p className="mt-2 text-sm font-medium text-cream/88">
                      {item}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-8 text-sm text-cream/58">{t('hero.socialProof')}</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
            <div className="shell-card overflow-hidden rounded-[2rem] p-6 md:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-brown/35">
                    Signature Edit
                  </p>
                  <h2 className="mt-3 font-heading text-3xl leading-none text-brown">
                    Cadeaus die luxe en betekenis combineren
                  </h2>
                </div>
                <div className="rounded-full border border-gold/20 bg-gold/10 px-4 py-2 text-xs font-semibold text-gold">
                  Rituals feel
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                {giftBoxes.slice(0, 4).map((product) => (
                  <div
                    key={product.id}
                    className="rounded-[1.4rem] border border-gold/10 bg-gradient-to-br from-white via-white to-sand/60 p-4"
                  >
                    <div className="text-4xl">{product.image}</div>
                    <p className="mt-4 text-xs uppercase tracking-[0.22em] text-brown/35">
                      {product.category}
                    </p>
                    <p className="mt-2 font-heading text-xl text-brown">
                      {product.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="shell-card rounded-[2rem] p-6 md:p-7">
              <p className="text-[11px] uppercase tracking-[0.28em] text-brown/35">
                Why customers convert
              </p>
              <div className="mt-5 space-y-4">
                {[
                  'Premium unboxing met zachte earth tones en gouden accenten',
                  'Duidelijke prijsniveaus voor gifting op elk budgetniveau',
                  'Geschikt voor NL, BE, FR en DE met meertalige storefront',
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-[1.2rem] border border-gold/12 bg-white/60 px-4 py-4"
                  >
                    <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-gold/12 text-xs text-gold">
                      ✓
                    </span>
                    <p className="text-sm leading-6 text-brown/72">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-7xl rounded-[1.8rem] border border-olive/12 bg-olive px-6 py-5 text-white shadow-[0_24px_60px_rgba(107,123,94,0.18)]">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm md:text-base">
            {[
              { icon: '✓', text: t('trust.halal') },
              { icon: '🎁', text: t('trust.giftWrap') },
              { icon: '🚚', text: t('trust.freeShipping') },
              { icon: '↩', text: t('trust.returns') },
            ].map((item) => (
              <span key={item.text} className="flex items-center gap-2">
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.text}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section ref={boxesRef} className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
        <div className="mb-14 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-gold">
              Signature collection
            </p>
            <h2 className="mt-4 font-heading text-4xl text-brown md:text-5xl">
              {t('sections.signatureBoxes')}
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-brown/58 md:text-base">
            Een warm, premium design dat overtuigt in Nederland, Belgie, Frankrijk
            en Duitsland begint met duidelijke gifting momenten en een sterke first
            impression.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {giftBoxes.map((product, index) => (
            <div
              key={product.id}
              className={`transition-all duration-700 ${
                boxesVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
              style={{ transitionDelay: `${index * 120}ms` }}
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </section>

      <section ref={categoriesRef} className="px-4 pb-20 md:px-6 md:pb-28">
        <div className="mx-auto max-w-7xl rounded-[2.2rem] border border-gold/12 bg-gradient-to-br from-sand via-[#f7efe2] to-cream p-7 shadow-[0_24px_80px_rgba(44,36,32,0.08)] md:p-10">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-gold">
                Occasions
              </p>
              <h2 className="mt-4 font-heading text-4xl text-brown md:text-5xl">
                {t('sections.shopByOccasion')}
              </h2>
            </div>
            <div className="rounded-full border border-gold/18 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-brown/52">
              mobile-first luxury storefront
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {shopCategories.map((category, index) => (
              <Link
                key={category.id}
                to={`/collections/${category.slug}`}
                className={`group relative overflow-hidden rounded-[1.8rem] border border-white/70 bg-white/72 p-7 shadow-[0_18px_50px_rgba(44,36,32,0.06)] transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_24px_70px_rgba(44,36,32,0.12)] ${
                  categoriesVisible
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-8 opacity-0'
                }`}
                style={{ transitionDelay: `${index * 110}ms` }}
              >
                <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-gold/10 blur-3xl transition-transform duration-500 group-hover:scale-110" />
                <div className="relative">
                  <span className="text-5xl">{category.icon}</span>
                  <h3 className="mt-6 font-heading text-2xl text-brown">
                    {t(`categories.${category.id}`)}
                  </h3>
                  <p className="arabic mt-2 text-sm text-gold">{category.nameAr}</p>
                  <p className="mt-4 text-sm leading-7 text-brown/60">
                    {t(`categoryDescriptions.${category.id}`)}
                  </p>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold transition-all duration-300 group-hover:gap-3">
                    {t('common.viewAll')}
                    <span>&rarr;</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section ref={reviewsRef} className="mx-auto max-w-7xl px-4 py-4 md:px-6">
        <div className="mb-12 text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-gold">
            Testimonials
          </p>
          <h2 className="mt-4 font-heading text-4xl text-brown md:text-5xl">
            {t('sections.customerReviews')}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {featuredReviews.map((review, index) => (
            <div
              key={review.id}
              className={`shell-card rounded-[1.8rem] p-6 transition-all duration-700 ${
                reviewsVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="font-heading text-5xl leading-none text-gold/28">
                  &ldquo;
                </span>
                <span className="rounded-full border border-gold/12 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                  {review.rating}.0
                </span>
              </div>
              <div className="mt-2 text-sm text-gold">{'★'.repeat(review.rating)}</div>
              <p className="mt-4 text-sm leading-7 text-brown/72">{review.text}</p>
              <div className="mt-6 border-t border-gold/12 pt-4">
                <p className="font-semibold text-brown">{review.name}</p>
                {review.verified && (
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-olive">
                    ✓ {t('common.verified')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-16 md:px-6">
        <div className="mx-auto max-w-7xl rounded-[1.8rem] border border-gold/12 bg-white/65 px-6 py-10 shadow-[0_20px_70px_rgba(44,36,32,0.06)] backdrop-blur">
          <p className="text-center text-[11px] uppercase tracking-[0.3em] text-brown/35">
            {t('partners.title')}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {partners.map((name) => (
              <span
                key={name}
                className="font-heading text-xl font-semibold text-brown/40 transition-colors duration-300 hover:text-brown/60"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 pt-4 md:px-6 md:pb-28">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[2.2rem] border border-gold/15 bg-white/75 p-8 shadow-[0_26px_90px_rgba(44,36,32,0.08)] backdrop-blur md:p-12">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gold/22 bg-gold/10 text-gold">
              ✦
            </div>
            <h2 className="mt-6 font-heading text-4xl text-brown md:text-5xl">
              {t('newsletter.heading')}
            </h2>
            <p className="mt-5 text-base leading-8 text-brown/62">
              {t('newsletter.subheading')}
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                alert(t('footer.subscribed'))
              }}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <input
                type="email"
                placeholder={t('newsletter.placeholder')}
                required
                className="gold-outline h-14 flex-1 rounded-full bg-cream/80 px-6 text-brown outline-none transition-all focus:border-gold focus:ring-2 focus:ring-gold/18"
              />
              <button
                type="submit"
                className="gold-gradient rounded-full px-8 py-4 font-semibold text-dark shadow-[0_18px_35px_rgba(198,168,108,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_45px_rgba(198,168,108,0.36)]"
              >
                {t('newsletter.button')}
              </button>
            </form>
            <p className="mt-5 text-xs uppercase tracking-[0.2em] text-brown/35">
              {t('newsletter.privacy')}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
