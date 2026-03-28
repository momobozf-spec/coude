import { useLanguageStore } from '../store/languageStore'

export default function AboutPage() {
  const { t } = useLanguageStore()

  const timeline = [
    { label: t('aboutExtra.timelineStart'), desc: t('aboutExtra.timelineStartDesc') },
    { label: t('aboutExtra.timelineLaunch'), desc: t('aboutExtra.timelineLaunchDesc') },
    { label: t('aboutExtra.timelineGrowth'), desc: t('aboutExtra.timelineGrowthDesc') },
    { label: t('aboutExtra.timelineNow'), desc: t('aboutExtra.timelineNowDesc') },
  ]

  const values = [
    {
      icon: '✨',
      title: t('aboutExtra.qualityTitle'),
      desc: t('aboutExtra.qualityDesc'),
    },
    {
      icon: '🕌',
      title: t('aboutExtra.meaningTitle'),
      desc: t('aboutExtra.meaningDesc'),
    },
    {
      icon: '🤝',
      title: t('aboutExtra.communityTitle'),
      desc: t('aboutExtra.communityDesc'),
    },
  ]

  return (
    <div className="min-h-screen">
      {/* Hero with parallax-like effect */}
      <section className="relative bg-sand overflow-hidden">
        <div
          className="absolute inset-0 pattern-bg opacity-40"
          style={{ transform: 'scale(1.1)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-sand/80" />
        <div className="max-w-3xl mx-auto px-4 py-24 md:py-32 text-center relative z-10">
          <p className="text-gold font-medium text-sm uppercase tracking-widest mb-4">
            About Us
          </p>
          <h1 className="font-heading text-4xl md:text-6xl font-bold text-brown mb-4">
            {t('about.title')}
          </h1>
          <p className="text-brown/60 text-lg">
            {t('aboutExtra.subtitle')}
          </p>
        </div>
      </section>

      {/* Mission statement banner */}
      <section className="relative overflow-hidden">
        <div className="gold-gradient py-8 md:py-10">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <p className="font-heading text-xl md:text-2xl font-semibold text-dark/90 italic">
              &ldquo;{t('aboutExtra.missionBanner')}&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* Brand story */}
      <section className="max-w-3xl mx-auto px-4 py-20 md:py-24">
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-brown mb-10">
          {t('about.whyTitle')}
        </h2>
        <div className="space-y-6 text-brown/70 leading-relaxed text-lg">
          <p>{t('aboutExtra.storyP1')}</p>
          <p>{t('aboutExtra.storyP2')}</p>
          <p>{t('aboutExtra.storyP3')}</p>
          <p>{t('aboutExtra.storyP4')}</p>
        </div>
      </section>

      {/* Timeline */}
      <section className="bg-sand/50 py-20 md:py-24">
        <div className="max-w-3xl mx-auto px-4">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-gold/30 md:-translate-x-px" />

            {timeline.map((item, i) => (
              <div
                key={i}
                className={`relative flex items-start gap-6 mb-12 last:mb-0 ${
                  i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                {/* Dot */}
                <div className="absolute left-4 md:left-1/2 w-3 h-3 bg-gold rounded-full -translate-x-1/2 mt-2 z-10 ring-4 ring-cream" />

                {/* Content */}
                <div className={`ml-10 md:ml-0 md:w-1/2 ${i % 2 === 0 ? 'md:pr-12 md:text-right' : 'md:pl-12'}`}>
                  <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                    <h3 className="font-heading text-lg font-bold text-brown mb-2">
                      {item.label}
                    </h3>
                    <p className="text-brown/60 text-sm leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 md:py-24">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-gold font-medium text-sm uppercase tracking-widest mb-3">
              Values
            </p>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-brown">
              {t('about.valuesTitle')}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((val) => (
              <div
                key={val.title}
                className="bg-white rounded-2xl p-8 text-center shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors duration-300">
                  <span className="text-3xl">{val.icon}</span>
                </div>
                <h3 className="font-heading text-xl font-bold text-brown mb-3">
                  {val.title}
                </h3>
                <p className="text-brown/60 text-sm leading-relaxed">
                  {val.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="bg-sand py-20 md:py-24">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-gold font-medium text-sm uppercase tracking-widest mb-3">
              Team
            </p>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-brown">
              {t('about.teamTitle')}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-lg mx-auto">
            {[
              {
                emoji: '👨‍💼',
                name: t('aboutExtra.jamalName'),
                role: t('aboutExtra.jamalRole'),
                desc: t('aboutExtra.jamalDesc'),
              },
              {
                emoji: '👩‍💼',
                name: t('aboutExtra.jamilaName'),
                role: t('aboutExtra.jamilaRole'),
                desc: t('aboutExtra.jamilaDesc'),
              },
            ].map((member) => (
              <div
                key={member.name}
                className="bg-white rounded-2xl p-8 text-center shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="w-24 h-24 mx-auto mb-5 rounded-full bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors duration-300">
                  <span className="text-5xl">{member.emoji}</span>
                </div>
                <h3 className="font-heading text-xl font-bold text-brown mb-1">
                  {member.name}
                </h3>
                <p className="text-gold text-sm font-medium mb-4">
                  {member.role}
                </p>
                <p className="text-brown/60 text-sm leading-relaxed">
                  {member.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Arabic closer with gold accents */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 pattern-bg bg-cream" />
        <div className="absolute top-0 left-0 w-full h-1 gold-gradient" />
        <div className="relative z-10 text-center">
          <div className="inline-block mb-6">
            <div className="w-10 h-10 border-2 border-gold/40 rotate-45 mx-auto" />
          </div>
          <p className="arabic text-gold text-4xl md:text-5xl mb-4 font-bold">
            {t('aboutExtra.closerArabic')}
          </p>
          <p className="font-heading text-xl md:text-2xl text-brown/70 italic">
            {t('about.beautyInEveryGift')}
          </p>
          <div className="mt-6">
            <div className="w-10 h-10 border-2 border-gold/40 rotate-45 mx-auto" />
          </div>
        </div>
      </section>
    </div>
  )
}
