import type { Metadata } from 'next'

import { PRICING } from '@/config/plans'
import { LegalEntityBlock } from '../legal-entity-block'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The agreement between you and the operator of Muslim Life.',
}

/**
 * Terms of use. Prices come from src/config/plans.ts so this page cannot drift
 * from the pricing page. Have it reviewed by a lawyer before launch.
 */
export default function TermsPage() {
  const monthly = `${PRICING.symbol}${PRICING.monthly.display}`
  const yearly = `${PRICING.symbol}${PRICING.yearly.display}`

  return (
    <article className="mx-auto max-w-3xl space-y-8 px-5 py-16 text-sm leading-relaxed">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">Terms of use</h1>
      </header>

      <Section title="1. Who we are">
        <p>Muslim Life is operated by:</p>
        <LegalEntityBlock />
      </Section>

      <Section title="2. The service">
        <p>
          Muslim Life is a lifestyle and productivity app: prayer times and tracking, a planner,
          habits, discovery of places and deals, and an assistant that helps you plan. It does not
          issue religious rulings and does not give medical, legal or financial advice. The
          assistant is not a scholar.
        </p>
        <p>
          Prayer times are calculated astronomically from your city and the method you choose.
          They can differ from your local mosque&apos;s timetable; always verify them.
        </p>
        <p>
          Listings marked <em>Demo</em> are fictional and shown to illustrate the feature. Deals
          from real partner businesses are honoured by those businesses under the terms shown with
          each deal.
        </p>
      </Section>

      <Section title="3. Your account">
        <p>
          You must give accurate details and keep your password to yourself. You are responsible
          for what happens under your account. You must be at least 16 years old, or have your
          parent&apos;s or guardian&apos;s permission.
        </p>
      </Section>

      <Section title="4. Free plan and Premium">
        <p>
          The free plan costs nothing. Premium costs {monthly} per month or {yearly} per year,
          VAT included, billed in advance through our payment provider (Stripe). New members get a{' '}
          {PRICING.trialDays}-day free trial on the yearly plan; you are charged when the trial
          ends unless you cancel before.
        </p>
        <p>
          Premium renews automatically for the same period until you cancel. You can cancel at any
          time from Settings → Billing; Premium then stays active until the end of the period you
          paid for, and is not renewed.
        </p>
      </Section>

      <Section title="5. Right of withdrawal (EU consumers)">
        <p>
          You may withdraw from a Premium purchase within 14 days without giving a reason by
          contacting us at the address above. Because you ask us to start the service immediately,
          you pay only for the part of the period already provided before you withdrew; we refund
          the rest within 14 days.
        </p>
      </Section>

      <Section title="6. Acceptable use">
        <p>
          Do not misuse the service: no attempts to access other members&apos; data, no automated
          scraping, no unlawful content in the assistant. We may suspend accounts that do.
        </p>
      </Section>

      <Section title="7. Liability">
        <p>
          We provide the service with care but cannot guarantee it is always available or
          error-free. Nothing in these terms limits liability that cannot be limited by law.
        </p>
      </Section>

      <Section title="8. Ending the agreement">
        <p>
          You can delete your account at any time from Settings → Privacy. Your data is then
          handled as described in the privacy policy.
        </p>
      </Section>

      <Section title="9. Changes and law">
        <p>
          We will tell you in advance about material changes to these terms. Belgian law applies,
          without depriving you of the protection of the mandatory law of the country where you
          live.
        </p>
      </Section>
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-[-0.01em]">{title}</h2>
      {children}
    </section>
  )
}
