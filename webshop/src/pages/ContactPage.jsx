import { useState } from 'react'
import { useLanguageStore } from '../store/languageStore'

export default function ContactPage() {
  const { t } = useLanguageStore()
  const [form, setForm] = useState({
    naam: '',
    email: '',
    onderwerp: t('contact.form.subjectOptions.general'),
    bericht: '',
  })
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 3000)
    setForm({
      naam: '',
      email: '',
      onderwerp: t('contact.form.subjectOptions.general'),
      bericht: '',
    })
  }

  const contactCards = [
    {
      icon: '📧',
      title: t('contact.info.email'),
      value: t('contactExtra.emailAddress'),
      sub: t('contactExtra.emailResponse'),
    },
    {
      icon: '💬',
      title: t('contact.info.whatsapp'),
      value: t('contactExtra.whatsappNumber'),
      sub: t('contactExtra.whatsappHours'),
    },
    {
      icon: '📷',
      title: t('contact.info.instagram'),
      value: t('contactExtra.instagramHandle'),
      sub: t('contactExtra.instagramDesc'),
    },
    {
      icon: '📍',
      title: t('contact.info.location'),
      value: t('contactExtra.locationAddress'),
      sub: t('contactExtra.locationDesc'),
    },
  ]

  const subjectOptions = [
    t('contact.form.subjectOptions.general'),
    t('contact.form.subjectOptions.order'),
    t('contactExtra.subjectReturn'),
    t('contact.form.subjectOptions.bulk'),
    t('contactExtra.subjectCollab'),
    t('contactExtra.subjectOther'),
  ]

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="bg-sand py-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 pattern-bg opacity-40" />
        <div className="max-w-3xl mx-auto px-4 relative z-10">
          <p className="text-gold font-medium text-sm uppercase tracking-widest mb-4">
            Contact
          </p>
          <h1 className="font-heading text-4xl md:text-6xl font-bold text-brown mb-4">
            {t('contact.title')}
          </h1>
          <p className="text-brown/60 text-lg">
            {t('contact.subtitle')}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact form */}
          <div className="bg-white rounded-2xl p-8 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 gold-gradient" />
            <h2 className="font-heading text-2xl font-bold text-brown mb-8">
              {t('contactExtra.formTitle')}
            </h2>

            {submitted && (
              <div className="mb-6 bg-olive/10 text-olive px-5 py-3 rounded-xl text-sm font-medium animate-fade-in">
                ✓ {t('contact.form.success')}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="relative">
                <input
                  type="text"
                  name="naam"
                  value={form.naam}
                  onChange={handleChange}
                  required
                  placeholder=" "
                  className="peer w-full px-4 pt-6 pb-2 rounded-xl border border-brown/15 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 bg-cream/50 transition-all"
                />
                <label className="absolute left-4 top-2 text-xs text-brown/50 font-medium transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-xs peer-focus:text-gold">
                  {t('contact.form.name')}
                </label>
              </div>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder=" "
                  className="peer w-full px-4 pt-6 pb-2 rounded-xl border border-brown/15 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 bg-cream/50 transition-all"
                />
                <label className="absolute left-4 top-2 text-xs text-brown/50 font-medium transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-xs peer-focus:text-gold">
                  {t('contact.form.email')}
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-brown/50 mb-2 ml-1">
                  {t('contact.form.subject')}
                </label>
                <select
                  name="onderwerp"
                  value={form.onderwerp}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-brown/15 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 bg-cream/50 cursor-pointer transition-all text-brown"
                >
                  {subjectOptions.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <textarea
                  name="bericht"
                  value={form.bericht}
                  onChange={handleChange}
                  required
                  rows={5}
                  placeholder=" "
                  className="peer w-full px-4 pt-6 pb-2 rounded-xl border border-brown/15 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 bg-cream/50 resize-none transition-all"
                />
                <label className="absolute left-4 top-2 text-xs text-brown/50 font-medium transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-xs peer-focus:text-gold">
                  {t('contact.form.message')}
                </label>
              </div>
              <button
                type="submit"
                className="w-full gold-gradient text-dark py-4 rounded-xl font-semibold hover:shadow-lg hover:shadow-gold/25 transition-all duration-300 cursor-pointer text-lg"
              >
                {t('contact.form.send')}
              </button>
            </form>
          </div>

          {/* Right side */}
          <div className="space-y-5">
            {/* Contact cards */}
            {contactCards.map((card) => (
              <div
                key={card.title}
                className="bg-white rounded-2xl p-6 shadow-sm flex items-start gap-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors duration-300 flex-shrink-0">
                  <span className="text-xl">{card.icon}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-brown mb-1">{card.title}</h3>
                  <p className="text-brown/70 text-sm">{card.value}</p>
                  <p className="text-brown/40 text-xs mt-1">{card.sub}</p>
                </div>
              </div>
            ))}

            {/* Map placeholder */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-sand h-48 flex items-center justify-center relative">
                <div className="text-center">
                  <span className="text-4xl block mb-2 opacity-40">📍</span>
                  <p className="text-brown/40 text-sm">{t('contactExtra.mapTitle')}</p>
                  <p className="text-brown/30 text-xs">{t('contactExtra.locationAddress')}</p>
                </div>
              </div>
            </div>

            {/* Business hours */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-heading text-lg font-bold text-brown mb-4 flex items-center gap-2">
                <span className="text-gold">🕐</span>
                {t('contactExtra.hoursTitle')}
              </h3>
              <div className="space-y-3">
                {[
                  { day: t('contactExtra.hoursMF'), time: t('contactExtra.hoursMFTime'), active: true },
                  { day: t('contactExtra.hoursSat'), time: t('contactExtra.hoursSatTime'), active: true },
                  { day: t('contactExtra.hoursSun'), time: t('contactExtra.hoursSunTime'), active: false },
                ].map((slot) => (
                  <div key={slot.day} className="flex items-center justify-between">
                    <span className="text-brown/70 text-sm">{slot.day}</span>
                    <span
                      className={`text-sm font-medium ${
                        slot.active ? 'text-olive' : 'text-brown/40'
                      }`}
                    >
                      {slot.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
