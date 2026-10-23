import Link from 'next/link'
import {
  ArrowRight,
  CalendarDays,
  Check,
  Compass,
  Lock,
  Repeat,
  ShieldCheck,
  Sparkles,
  Store,
  Tag,
} from 'lucide-react'

import { DashboardPreview } from '@/components/marketing/dashboard-preview'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PRICING } from '@/config/plans'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

const FEATURES = [
  { key: 'prayer', icon: Compass },
  { key: 'planner', icon: CalendarDays },
  { key: 'habits', icon: Repeat },
  { key: 'discovery', icon: Store },
  { key: 'assistant', icon: Sparkles },
  { key: 'privacy', icon: Lock },
] as const

const FAQS = ['1', '2', '3', '4', '5', '6'] as const

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <PlannerSection />
      <AssistantSection />
      <DiscoverySection />
      <PremiumSection />
      {/* No testimonials section until real members have given real quotes. */}
      <Faq />
      <FinalCta />
    </>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* A single soft light source behind the headline. Restraint over gradients. */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-40 h-[30rem] opacity-60"
        style={{
          background:
            'radial-gradient(50% 50% at 50% 50%, var(--primary-subtle) 0%, transparent 70%)',
        }}
        aria-hidden
      />
      <div className="bg-geometric pointer-events-none absolute inset-0 opacity-40" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="primary" className="animate-fade-in">
            <span className="size-1.5 rounded-full bg-primary" />
            {t('landing.hero.badge')}
          </Badge>

          <h1 className="animate-rise mt-6 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-6xl">
            {t('landing.hero.title')}
          </h1>

          <p className="animate-rise mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t('landing.hero.subtitle')}
          </p>

          <div className="animate-rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild className="w-full sm:w-auto">
              <Link href="/register">
                {t('landing.hero.cta')}
                <ArrowRight className="rtl:rotate-180" />
              </Link>
            </Button>
            <Button size="lg" variant="secondary" asChild className="w-full sm:w-auto">
              <Link href="#features">{t('landing.hero.ctaSecondary')}</Link>
            </Button>
          </div>

          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {[
              t('landing.hero.noCard'),
              t('landing.trust.private'),
              t('landing.trust.noAds'),
              t('landing.trust.cancel'),
            ].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="size-3.5 text-primary" strokeWidth={2.5} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto mt-14 max-w-3xl">
          <DashboardPreview className="animate-rise" />
          {/* Fade the preview into the page rather than ending it with a hard edge. */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent"
            aria-hidden
          />
        </div>
      </div>
    </section>
  )
}

// ─── Features ────────────────────────────────────────────────────────────────

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  align?: 'center' | 'start'
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow ? (
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-primary">
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          'text-balance font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl',
          eyebrow && 'mt-3',
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  )
}

function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-t border-border py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          title={t('landing.features.title')}
          subtitle={t('landing.features.subtitle')}
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ key, icon: Icon }) => (
            <Card key={key} className="p-6 transition-shadow hover:shadow-md">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary-subtle">
                <Icon className="size-5 text-primary-subtle-foreground" />
              </div>
              <h3 className="mt-5 text-base font-semibold tracking-[-0.01em]">
                {t(`landing.features.${key}.title` as never)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t(`landing.features.${key}.body` as never)}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Planner ─────────────────────────────────────────────────────────────────

function PlannerSection() {
  const points = [
    t('landing.plannerSection.point1'),
    t('landing.plannerSection.point2'),
    t('landing.plannerSection.point3'),
  ]

  return (
    <section id="planner" className="scroll-mt-20 border-t border-border bg-surface-sunken py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
        <div>
          <SectionHeading
            align="start"
            eyebrow={t('landing.plannerSection.eyebrow')}
            title={t('landing.plannerSection.title')}
            subtitle={t('landing.plannerSection.body')}
          />
          <ul className="mt-8 space-y-3.5">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-subtle">
                  <Check className="size-3 text-primary-subtle-foreground" strokeWidth={3} />
                </span>
                <span className="text-sm text-foreground">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <HabitGridPreview />
      </div>
    </section>
  )
}

function HabitGridPreview() {
  const habits = [
    { name: 'Read Quran', streak: 12, done: [1, 1, 1, 1, 0, 1, 1] },
    { name: 'Morning adhkar', streak: 24, done: [1, 1, 1, 1, 1, 1, 1] },
    { name: 'Exercise', streak: 3, done: [0, 1, 1, 0, 1, 0, 1] },
    { name: 'Sleep before 23:00', streak: 5, done: [1, 0, 1, 1, 1, 0, 1] },
  ]
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <Card variant="raised" className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold tracking-[-0.01em]">This week</p>
        <Badge variant="success" size="sm">
          82% complete
        </Badge>
      </div>

      <div className="mt-5 space-y-3.5">
        {habits.map((habit) => (
          <div key={habit.name} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{habit.name}</p>
              <p className="text-[0.625rem] text-muted-foreground">{habit.streak} day streak</p>
            </div>
            <div className="flex gap-1">
              {habit.done.map((done, index) => (
                <span
                  key={`${habit.name}-${days[index]}-${index}`}
                  className={cn(
                    'size-5 rounded-[0.3rem]',
                    done ? 'bg-primary' : 'bg-muted',
                  )}
                  title={days[index]}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end gap-1 pe-0.5">
        {days.map((day, index) => (
          <span
            key={`${day}-${index}`}
            className="w-5 text-center text-[0.5625rem] text-muted-foreground"
          >
            {day}
          </span>
        ))}
      </div>
    </Card>
  )
}

// ─── Assistant ───────────────────────────────────────────────────────────────

function AssistantSection() {
  const examples = [
    t('landing.assistantSection.example1'),
    t('landing.assistantSection.example2'),
    t('landing.assistantSection.example3'),
  ]

  return (
    <section id="assistant" className="scroll-mt-20 border-t border-border py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
        <Card variant="raised" className="order-2 overflow-hidden lg:order-1">
          <div className="space-y-4 p-5">
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-ee-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                {examples[0]}
              </div>
            </div>

            <div className="flex gap-2.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-subtle">
                <Sparkles className="size-3.5 text-primary-subtle-foreground" />
              </div>
              <div className="max-w-[85%] space-y-3 rounded-2xl rounded-ss-md bg-muted px-4 py-3">
                <p className="text-sm text-foreground">
                  Here&apos;s a plan for your trip. I&apos;ve grouped it into four parts —
                  add any of it to your planner.
                </p>
                <ul className="space-y-1.5">
                  {[
                    'Before you fly — 6 tasks',
                    'Prayer while travelling — qasr notes',
                    'Halal food near Sultanahmet — 8 places',
                    'Packing checklist — 14 items',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="size-3 shrink-0 text-primary" strokeWidth={3} />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button size="sm" variant="subtle" className="w-full">
                  Add to planner
                </Button>
              </div>
            </div>
          </div>

          <div className="border-t border-border bg-surface-sunken px-5 py-3">
            <p className="flex items-start gap-2 text-[0.6875rem] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-px size-3.5 shrink-0" />
              {t('landing.assistantSection.disclaimer')}
            </p>
          </div>
        </Card>

        <div className="order-1 lg:order-2">
          <SectionHeading
            align="start"
            eyebrow={t('landing.assistantSection.eyebrow')}
            title={t('landing.assistantSection.title')}
            subtitle={t('landing.assistantSection.body')}
          />
          <div className="mt-8 flex flex-wrap gap-2">
            {examples.map((example) => (
              <span
                key={example}
                className="rounded-full border border-border bg-surface px-3.5 py-2 text-xs text-muted-foreground"
              >
                &ldquo;{example}&rdquo;
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Discovery ───────────────────────────────────────────────────────────────

function DiscoverySection() {
  const listings = [
    { name: 'Atlas Grill', city: 'Brussels', category: 'Restaurant', deal: '20% off', premium: true },
    { name: 'Noor Books', city: 'Amsterdam', category: 'Bookstore', deal: '15% off', premium: false },
    { name: 'Maison Modeste', city: 'Paris', category: 'Modest fashion', deal: '10% off', premium: true },
    { name: 'Yusuf Butchery', city: 'London', category: 'Butcher', deal: 'Free delivery', premium: false },
  ]

  return (
    <section className="border-t border-border bg-surface-sunken py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          eyebrow={t('landing.discoverySection.eyebrow')}
          title={t('landing.discoverySection.title')}
          subtitle={t('landing.discoverySection.body')}
        />

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {listings.map((listing) => (
            <Card key={listing.name} className="overflow-hidden">
              <div
                className="h-24 bg-primary-subtle"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 1px 1px, color-mix(in oklch, var(--primary) 18%, transparent) 1px, transparent 0)',
                  backgroundSize: '16px 16px',
                }}
                aria-hidden
              />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tracking-[-0.01em]">
                      {listing.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {listing.category} · {listing.city}
                    </p>
                  </div>
                  <Badge variant="default" size="sm">
                    {t('common.demo')}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Tag className="size-3.5 text-accent" />
                  <span className="text-xs font-medium">{listing.deal}</span>
                  {listing.premium ? (
                    <Badge variant="accent" size="sm" className="ms-auto">
                      <Lock className="size-2.5" />
                      {t('common.premium')}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Listings shown are demonstration data during early access.
        </p>
      </div>
    </section>
  )
}

// ─── Premium ─────────────────────────────────────────────────────────────────

function PremiumSection() {
  return (
    <section className="border-t border-border py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <Card
          variant="flat"
          className="relative overflow-hidden border-primary/20 bg-primary-subtle p-8 sm:p-14"
        >
          <div
            className="bg-geometric pointer-events-none absolute inset-0 opacity-50"
            aria-hidden
          />
          <div className="relative grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-primary-subtle-foreground/70">
                {t('landing.premium.eyebrow')}
              </p>
              <h2 className="mt-3 text-balance font-display text-3xl font-semibold tracking-[-0.025em] text-primary-subtle-foreground sm:text-4xl">
                {t('landing.premium.title')}
              </h2>
              <p className="mt-4 max-w-md text-pretty leading-relaxed text-primary-subtle-foreground/80">
                {t('landing.premium.body')}
              </p>

              <div className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-display text-4xl font-semibold tracking-[-0.03em] text-primary-subtle-foreground">
                  {PRICING.symbol}
                  {PRICING.monthly.display}
                </span>
                <span className="text-sm text-primary-subtle-foreground/70">
                  {t('pricing.perMonth')} · {PRICING.symbol}
                  {PRICING.yearly.display}
                  {t('pricing.perYear')}
                </span>
              </div>

              <Button size="lg" asChild className="mt-8">
                <Link href="/pricing">
                  {t('landing.premium.cta')}
                  <ArrowRight className="rtl:rotate-180" />
                </Link>
              </Button>
            </div>

            <ul className="space-y-3">
              {[
                // Only what Premium actually unlocks today (see PLAN_FEATURES).
                'Unlimited habits',
                'Unlimited saved places',
                '500 assistant messages a month',
                'Plan generators: week, Ramadan, travel and life events',
                'Member-only deals from partner businesses, as they join',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  <span className="text-sm text-primary-subtle-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </section>
  )
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-border py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-5">
        <SectionHeading title={t('landing.faq.title')} />

        <dl className="mt-12 divide-y divide-border border-y border-border">
          {FAQS.map((n) => (
            <div key={n} className="py-6">
              <dt className="text-base font-semibold tracking-[-0.01em]">
                {t(`landing.faq.q${n}` as never)}
              </dt>
              <dd className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                {t(`landing.faq.a${n}` as never)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

// ─── Final CTA ───────────────────────────────────────────────────────────────

function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-border py-24 sm:py-32">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-80 opacity-60"
        style={{
          background:
            'radial-gradient(50% 60% at 50% 100%, var(--primary-subtle) 0%, transparent 70%)',
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-2xl px-5 text-center">
        <h2 className="text-balance font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
          {t('landing.cta.title')}
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-pretty leading-relaxed text-muted-foreground">
          {t('landing.cta.subtitle')}
        </p>
        <Button size="xl" asChild className="mt-9">
          <Link href="/register">
            {t('landing.cta.button')}
            <ArrowRight className="rtl:rotate-180" />
          </Link>
        </Button>
        <p className="mt-4 text-xs text-muted-foreground">{t('landing.hero.noCard')}</p>
      </div>
    </section>
  )
}
