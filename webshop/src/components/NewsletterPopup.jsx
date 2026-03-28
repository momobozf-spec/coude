import { useState, useEffect } from 'react'
import { useLanguageStore } from '../store/languageStore'

const STORAGE_KEY = 'jj_newsletter_shown'

export default function NewsletterPopup() {
  const [visible, setVisible] = useState(false)
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const { t } = useLanguageStore()

  useEffect(() => {
    const alreadyShown = localStorage.getItem(STORAGE_KEY)
    if (alreadyShown) return

    const timer = setTimeout(() => {
      setVisible(true)
      localStorage.setItem(STORAGE_KEY, 'true')
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (email) {
      setSubmitted(true)
      setTimeout(() => setVisible(false), 2000)
    }
  }

  if (!visible) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[60] bg-dark/50 backdrop-blur-md transition-opacity duration-500"
        onClick={() => setVisible(false)}
        style={{ animation: 'fadeIn 0.4s ease-out' }}
      />

      {/* Popup */}
      <div
        className="fixed left-1/2 top-1/2 z-[60] w-[90%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-cream shadow-2xl shadow-dark/20 overflow-hidden"
        style={{ animation: 'fadeIn 0.5s ease-out' }}
      >
        {/* Top gold accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-gold/60 via-gold to-gold/60" />

        <div className="p-8">
          {/* Close button */}
          <button
            onClick={() => setVisible(false)}
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg text-brown/30 hover:bg-sand hover:text-brown transition-all duration-200"
            aria-label={t('cart.close')}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Brand logo */}
          <div className="flex justify-center mb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-gold via-gold/90 to-gold/70 text-cream font-arabic text-2xl font-bold shadow-md shadow-gold/20">
              {'\u062C'}
            </div>
          </div>

          {/* Gold accent line */}
          <div className="mx-auto mb-5 h-[2px] w-12 rounded-full bg-gradient-to-r from-transparent via-gold to-transparent" />

          {submitted ? (
            <div className="text-center py-4">
              <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-olive/10 mb-4">
                <svg className="h-8 w-8 text-olive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="font-heading text-2xl font-bold text-brown">
                {t('newsletter.thankYou')}
              </p>
              <p className="mt-2 text-sm text-brown/50 leading-relaxed">
                {t('newsletter.thankYouText')}
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="font-heading text-2xl font-bold text-brown leading-tight">
                  {t('newsletter.title')}
                </h2>
                <p className="mt-3 text-sm text-brown/60 leading-relaxed max-w-xs mx-auto">
                  {t('newsletter.description')}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('newsletter.emailPlaceholder')}
                  required
                  className="w-full rounded-xl border border-sand bg-white px-4 py-3.5 text-sm text-brown placeholder:text-brown/35 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/10 transition-all duration-300"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-gold via-gold to-gold/90 py-3.5 text-sm font-bold text-dark hover:from-gold/90 hover:to-gold transition-all duration-300 shadow-md shadow-gold/20 hover:shadow-lg hover:shadow-gold/30 active:scale-[0.98]"
                >
                  {t('newsletter.submit')}
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-brown/35">
                {t('newsletter.unsubscribe')}
              </p>
            </>
          )}
        </div>
      </div>
    </>
  )
}
