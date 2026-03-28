import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguageStore, FLAGS, LABELS } from '../store/languageStore'

const collections = [
  { key: 'ramadan', slug: 'ramadan-cadeaus' },
  { key: 'eid', slug: 'eid-cadeaus' },
  { key: 'geboorte', slug: 'geboorte-aqiqah' },
  { key: 'huwelijk', slug: 'nikah-huwelijk' },
  { key: 'zelfzorg', slug: 'zelfzorg' },
]

const serviceLinks = [
  { key: 'shipping', to: '/faq' },
  { key: 'returns', to: '/faq' },
  { key: 'faq', to: '/faq' },
  { key: 'contact', to: '/contact' },
  { key: 'about', to: '/over-ons' },
]

const languages = ['nl', 'fr', 'de', 'en']

export default function Footer() {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const { t, language, setLanguage } = useLanguageStore()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (email) {
      setSubscribed(true)
      setEmail('')
    }
  }

  return (
    <footer className="bg-dark text-cream">
      {/* Gold divider */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-gold via-gold/90 to-gold/70 text-cream font-arabic text-xl font-bold shadow-md shadow-gold/20">
                {'\u062C'}
              </div>
              <span className="font-heading text-xl font-semibold text-cream">
                Jamal &amp; Jamila
              </span>
            </div>
            <p className="text-sm text-cream/60 leading-relaxed mb-5">
              {t('footer.description')}
            </p>
            <p className="font-arabic text-lg text-gold/70" dir="rtl">
              {'\u0628\u0633\u0645 \u0627\u0644\u0644\u0647 \u0627\u0644\u0631\u062D\u0645\u0646 \u0627\u0644\u0631\u062D\u064A\u0645'}
            </p>
          </div>

          {/* Shop */}
          <div>
            <h3 className="font-heading text-lg font-semibold text-cream mb-5">
              {t('footer.shop')}
            </h3>
            <div className="h-[1px] w-8 bg-gold/40 mb-4" />
            <ul className="space-y-2.5">
              {collections.map((collection) => (
                <li key={collection.key}>
                  <Link
                    to={`/collections/${collection.slug}`}
                    className="text-sm text-cream/60 hover:text-gold transition-colors duration-300 hover:translate-x-1 inline-block"
                  >
                    {t(`collections.${collection.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer service */}
          <div>
            <h3 className="font-heading text-lg font-semibold text-cream mb-5">
              {t('footer.customerService')}
            </h3>
            <div className="h-[1px] w-8 bg-gold/40 mb-4" />
            <ul className="space-y-2.5">
              {serviceLinks.map((link) => (
                <li key={link.key}>
                  <Link
                    to={link.to}
                    className="text-sm text-cream/60 hover:text-gold transition-colors duration-300 hover:translate-x-1 inline-block"
                  >
                    {t(`footer.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="font-heading text-lg font-semibold text-cream mb-5">
              {t('footer.newsletter')}
            </h3>
            <div className="h-[1px] w-8 bg-gold/40 mb-4" />
            <p className="text-sm text-cream/60 mb-4 leading-relaxed">
              {t('footer.newsletterText')}
            </p>
            {subscribed ? (
              <p className="text-sm text-gold font-medium">
                {t('footer.subscribed')}
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('footer.emailPlaceholder')}
                  required
                  className="rounded-lg bg-cream/5 px-4 py-2.5 text-sm text-cream placeholder:text-cream/30 border border-cream/10 focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/20 transition-all duration-300"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-gradient-to-r from-gold to-gold/90 px-4 py-2.5 text-sm font-semibold text-dark hover:from-gold/90 hover:to-gold transition-all duration-300 shadow-sm shadow-gold/20"
                >
                  {t('footer.subscribe')}
                </button>
              </form>
            )}

            {/* Social icons */}
            <div className="mt-6 flex gap-4">
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-cream/5 text-cream/50 hover:bg-gold/20 hover:text-gold transition-all duration-300"
                aria-label="Instagram"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-cream/5 text-cream/50 hover:bg-gold/20 hover:text-gold transition-all duration-300"
                aria-label="Facebook"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-cream/5 text-cream/50 hover:bg-gold/20 hover:text-gold transition-all duration-300"
                aria-label="TikTok"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Payment methods & language */}
        <div className="mt-12 pt-8 border-t border-cream/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Payment methods */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-cream/40 font-medium uppercase tracking-wider mr-1">
                {t('footer.paymentMethods')}:
              </span>
              {['iDEAL', 'Bancontact', 'Visa', 'Mastercard', 'PayPal', 'Apple Pay'].map((method) => (
                <span
                  key={method}
                  className="rounded-md bg-cream/5 border border-cream/10 px-2.5 py-1 text-xs text-cream/50"
                >
                  {method}
                </span>
              ))}
            </div>

            {/* Footer language switcher */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-cream/40 font-medium uppercase tracking-wider mr-1">
                {t('footer.language')}:
              </span>
              {languages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-all duration-200 ${
                    language === lang
                      ? 'bg-gold/20 text-gold border border-gold/30'
                      : 'text-cream/50 hover:text-gold border border-cream/10 hover:border-gold/30'
                  }`}
                >
                  <span>{FLAGS[lang]}</span>
                  <span>{LABELS[lang]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-cream/10">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-cream/40">
          <p>{t('footer.copyright')}</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-gold transition-colors duration-300">
              {t('footer.privacy')}
            </Link>
            <Link to="/voorwaarden" className="hover:text-gold transition-colors duration-300">
              {t('footer.terms')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
