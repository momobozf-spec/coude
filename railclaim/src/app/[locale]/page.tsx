import { getTranslations, setRequestLocale } from 'next-intl/server'

import { VERIFIED_COMPENSATION_RULES } from '@/lib/compensation/verified-rules'

const SINGLE = VERIFIED_COMPENSATION_RULES.find((r) => r.rule_key === 'SINGLE_DELAY')!
const FREQUENT = VERIFIED_COMPENSATION_RULES.find((r) => r.rule_key === 'FREQUENT_DELAYS')!

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations('landing')
  const tApp = await getTranslations('app')
  const tComp = await getTranslations('compensation')

  const verifiedOn = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-BE' : 'nl-BE', {
    dateStyle: 'long',
  }).format(new Date(SINGLE.verified_at))

  const steps = [
    { title: t('step1Title'), body: t('step1Body') },
    { title: t('step2Title'), body: t('step2Body') },
    { title: t('step3Title'), body: t('step3Body') },
    { title: t('step4Title'), body: t('step4Body') },
  ]

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-3xl px-5 pt-16 pb-12 sm:pt-24">
        <p className="text-sm font-medium tracking-wide text-sky-400 uppercase">
          {tApp('name')}
        </p>
        <h1 className="mt-3 text-3xl leading-tight font-semibold text-balance sm:text-5xl">
          {t('headline')}
        </h1>
        <p className="mt-5 text-base text-pretty text-slate-300 sm:text-lg">
          {t('subheadline')}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href={`/${locale}/register`}
            className="inline-flex items-center justify-center rounded-lg bg-sky-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-sky-400"
          >
            {t('ctaPrimary')}
          </a>
          <a
            href="#compensatie"
            className="inline-flex items-center justify-center rounded-lg border border-slate-700 px-5 py-3 font-medium text-slate-200 transition hover:border-slate-500"
          >
            {t('ctaSecondary')}
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-12">
        <h2 className="text-xl font-semibold sm:text-2xl">{t('howItWorksTitle')}</h2>
        <ol className="mt-6 space-y-5">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-sky-400"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="font-medium text-slate-100">{step.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* The rules, quoted with their source. Nothing here is our invention. */}
      <section id="compensatie" className="mx-auto max-w-3xl px-5 py-12">
        <h2 className="text-xl font-semibold sm:text-2xl">{tComp('amountLabel')}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            {
              title: tComp('singleDelayTitle'),
              body: tComp('singleDelayBody'),
              source: SINGLE.source_url,
            },
            {
              title: tComp('frequentDelaysTitle'),
              body: tComp('frequentDelaysBody'),
              source: FREQUENT.source_url,
            },
          ].map((card) => (
            <article
              key={card.title}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
            >
              <h3 className="font-medium text-slate-100">{card.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{card.body}</p>
              <a
                href={card.source}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-3 inline-block text-xs text-sky-400 underline underline-offset-2"
              >
                {tComp('source')}: belgiantrain.be
              </a>
            </article>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          {t('rulesSourceNote')} {tComp('verifiedOn', { date: verifiedOn })}.
        </p>
      </section>

      {/* Saying plainly what we do not do is a feature, not fine print. */}
      <section className="mx-auto max-w-3xl px-5 py-12">
        <h2 className="text-xl font-semibold sm:text-2xl">{t('honestyTitle')}</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-emerald-400 uppercase">
              {t('honestyDoTitle')}
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {[t('honestyDo1'), t('honestyDo2'), t('honestyDo3'), t('honestyDo4')].map(
                (item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden className="text-emerald-400">
                      +
                    </span>
                    <span>{item}</span>
                  </li>
                ),
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-amber-400 uppercase">
              {t('honestyDontTitle')}
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {[t('honestyDont1'), t('honestyDont2'), t('honestyDont3')].map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="text-amber-400">
                    −
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <footer className="mt-8 border-t border-slate-800 px-5 py-8">
        <div className="mx-auto max-w-3xl space-y-2 text-xs text-slate-500">
          <p>{tApp('disclaimer')}</p>
          <p>{tApp('attribution')}</p>
        </div>
      </footer>
    </main>
  )
}
