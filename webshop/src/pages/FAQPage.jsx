import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLanguageStore } from '../store/languageStore'

export default function FAQPage() {
  const { t } = useLanguageStore()
  const [openIndex, setOpenIndex] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  const faqCategories = [
    t('faqExtra.categoryAll'),
    t('faqExtra.categoryOrder'),
    t('faqExtra.categoryPayment'),
    t('faqExtra.categoryProducts'),
  ]

  const filteredFaqs = useMemo(() => {
    const faqItems = [
      {
        question: t('faq.shipping.q'),
        answer: t('faq.shipping.a'),
        category: t('faqExtra.categoryOrder'),
      },
      {
        question: t('faq.returns.q'),
        answer: t('faq.returns.a'),
        category: t('faqExtra.categoryOrder'),
      },
      {
        question: t('faq.payment.q'),
        answer: t('faq.payment.a'),
        category: t('faqExtra.categoryPayment'),
      },
      {
        question: t('faq.personalization.q'),
        answer: t('faq.personalization.a'),
        category: t('faqExtra.categoryProducts'),
      },
      {
        question: t('faq.bulk.q'),
        answer: t('faq.bulk.a'),
        category: t('faqExtra.categoryProducts'),
      },
      {
        question: t('faq.halal.q'),
        answer: t('faq.halal.a'),
        category: t('faqExtra.categoryProducts'),
      },
    ]

    let result = [...faqItems]

    if (activeCategory !== 'all') {
      result = result.filter((item) => item.category === activeCategory)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (item) =>
          item.question.toLowerCase().includes(q) ||
          item.answer.toLowerCase().includes(q)
      )
    }

    return result
  }, [searchQuery, activeCategory, t])

  const toggle = (i) => {
    setOpenIndex(openIndex === i ? null : i)
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="bg-sand py-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 pattern-bg opacity-40" />
        <div className="max-w-3xl mx-auto px-4 relative z-10">
          <p className="text-gold font-medium text-sm uppercase tracking-widest mb-4">
            FAQ
          </p>
          <h1 className="font-heading text-4xl md:text-6xl font-bold text-brown mb-4">
            {t('faq.title')}
          </h1>
          <p className="text-brown/60 text-lg mb-8">
            {t('faqExtra.subtitle')}
          </p>

          {/* Search */}
          <div className="relative max-w-md mx-auto">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brown/40 pointer-events-none">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('faqExtra.searchPlaceholder')}
              className="w-full pl-12 pr-4 py-4 rounded-full border border-brown/15 bg-white text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 shadow-sm transition-all"
            />
          </div>
        </div>
      </section>

      {/* FAQ content */}
      <section className="max-w-2xl mx-auto px-4 py-12">
        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {faqCategories.map((cat) => {
            const isAll = cat === t('faqExtra.categoryAll')
            const isActive = isAll ? activeCategory === 'all' : activeCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(isAll ? 'all' : cat)}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 cursor-pointer ${
                  isActive
                    ? 'gold-gradient text-dark shadow-sm'
                    : 'bg-sand text-brown/70 hover:bg-gold/10'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>

        {/* FAQ accordion */}
        <div className="space-y-3">
          {filteredFaqs.map((item, i) => {
            const isOpen = openIndex === i
            return (
              <div
                key={i}
                className={`bg-white rounded-2xl overflow-hidden shadow-sm transition-all duration-300 ${
                  isOpen ? 'ring-1 ring-gold/30' : ''
                }`}
              >
                <button
                  onClick={() => toggle(i)}
                  className="w-full flex items-center justify-between p-6 text-left cursor-pointer hover:bg-sand/30 transition-colors duration-200"
                >
                  <div className="flex-1 pr-4">
                    <span className="text-xs text-gold font-medium uppercase tracking-wider block mb-1">
                      {item.category}
                    </span>
                    <span className="font-semibold text-brown text-base">
                      {item.question}
                    </span>
                  </div>
                  <span
                    className={`text-gold text-lg transition-transform duration-300 flex-shrink-0 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>
                <div
                  className="overflow-hidden transition-all duration-300"
                  style={{
                    maxHeight: isOpen ? '500px' : '0',
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  <div className="px-6 pb-6">
                    <div className="border-t border-sand pt-4">
                      <p className="text-brown/70 leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {filteredFaqs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-brown/40 text-lg">{t('shop.noProducts')}</p>
          </div>
        )}

        {/* Still questions? */}
        <div className="text-center mt-16 p-10 bg-white rounded-2xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 gold-gradient" />
          <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-gold/10 flex items-center justify-center">
            <span className="text-2xl">💬</span>
          </div>
          <h3 className="font-heading text-2xl font-bold text-brown mb-3">
            {t('faqExtra.stillQuestions')}
          </h3>
          <p className="text-brown/60 mb-6">
            {t('faqExtra.stillQuestionsDesc')}
          </p>
          <Link
            to="/contact"
            className="gold-gradient text-dark px-8 py-3 rounded-full font-semibold hover:shadow-lg hover:shadow-gold/25 transition-all duration-300 inline-block"
          >
            {t('faq.contactUs')}
          </Link>
        </div>
      </section>
    </div>
  )
}
