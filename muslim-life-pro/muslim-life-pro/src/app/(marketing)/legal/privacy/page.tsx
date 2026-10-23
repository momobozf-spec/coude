import type { Metadata } from 'next'
import Link from 'next/link'

import { PRIVACY_VERSION } from '@/config/legal'
import { LegalEntityBlock } from '../legal-entity-block'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'How Muslim Life handles your personal data.',
}

/**
 * Privacy notice (GDPR art. 13). Written against what the code actually does —
 * see src/server/modules/privacy/retention-policy.ts and assistant/context.ts.
 * Have it reviewed by a lawyer before launch; update it when a processor changes.
 */
export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-5 py-16 text-sm leading-relaxed">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">Privacy policy</h1>
        <p className="text-muted-foreground">Version {PRIVACY_VERSION}</p>
      </header>

      <Section title="1. Who is responsible">
        <p>The controller of your personal data is:</p>
        <LegalEntityBlock />
      </Section>

      <Section title="2. What we process, and why">
        <ul className="list-disc space-y-2 ps-5">
          <li>
            <strong>Account</strong> — name, e-mail address and a hashed password. Needed to
            provide your account (contract, art. 6(1)(b) GDPR).
          </li>
          <li>
            <strong>Settings</strong> — your city (never your live location), country,
            prayer-calculation method, madhab, interests, goals, language and theme. Used to
            calculate prayer times and personalise the app (contract).
          </li>
          <li>
            <strong>Prayer, worship and habit records</strong> — what you log, plan and reflect
            on. Records of prayer and worship can reveal your religion, which is a special
            category of data. We process it only with your <strong>explicit consent</strong>{' '}
            (art. 9(2)(a) GDPR), given when you create your account. You can withdraw consent at
            any time by deleting this data or your account (see section 6); this does not affect
            processing before withdrawal.
          </li>
          <li>
            <strong>Tasks, planner, reflections, saved places and redeemed deals</strong> —
            content you create (contract).
          </li>
          <li>
            <strong>Assistant conversations</strong> — your messages and the replies, stored so
            you can continue a conversation (contract).
          </li>
          <li>
            <strong>Subscription</strong> — plan, status, billing period and the payment
            provider&apos;s customer and subscription references. We never receive your card
            details (contract; accounting obligations, art. 6(1)(c)).
          </li>
          <li>
            <strong>Security and usage</strong> — an audit log of security-relevant actions,
            short-lived rate-limit counters keyed by IP address or e-mail (deleted within a day),
            and product analytics that contain only event names, numbers and yes/no values —
            never content (legitimate interest in a secure, working service, art. 6(1)(f)).
          </li>
        </ul>
        <p>
          There is no public profile, feed or leaderboard. Your prayer and habit records are never
          shown to other members, never sold and never used for advertising.
        </p>
      </Section>

      <Section title="3. The assistant">
        <p>
          When a real AI provider is connected, the assistant sends your message to that provider
          together with a limited, non-sensitive context: today&apos;s date, your timezone and
          city, today&apos;s prayer times, the names of your active habits, upcoming task titles,
          planner blocks and your stated goals. It never sends your reflections, task
          descriptions or notes, or whether you prayed. Do not type anything into the assistant
          that you do not want to share with that provider. The assistant is not a scholar and
          gives no religious rulings.
        </p>
      </Section>

      <Section title="4. Who processes data for us">
        <ul className="list-disc space-y-2 ps-5">
          <li>Hosting and database providers, which store the application and its data.</li>
          <li>Stripe (payments), only if you buy Premium.</li>
          <li>Resend (e-mail), only to send password-reset messages.</li>
          <li>
            An AI provider (Anthropic or OpenAI), only if the assistant is connected to one. These
            providers are based in the United States; transfers rely on the EU–US Data Privacy
            Framework or standard contractual clauses.
          </li>
        </ul>
        <p>Each processes data only on our instructions, under a data-processing agreement.</p>
      </Section>

      <Section title="5. How long we keep it">
        <p>
          Your content is kept while you have an account. When you delete your account, your
          content is deleted; prayer records are deleted outright and never anonymised. A small
          set of records survives in anonymised form (subscription and usage counters,
          redemption records for partner businesses) or intact where the law requires it
          (security audit log, accounting records). The exact list is shown on the privacy page
          inside the app.
        </p>
      </Section>

      <Section title="6. Your rights">
        <p>
          You can access and download all your data, correct it, delete what you have tracked,
          or delete your account at any time from{' '}
          <Link href="/app/settings/privacy" className="text-primary hover:underline">
            Settings → Privacy
          </Link>
          . You also have the right to object, to restrict processing and to data portability.
          Contact us using the address in section 1. You may lodge a complaint with your data
          protection authority — in Belgium the Gegevensbeschermingsautoriteit / Autorité de
          protection des données (www.dataprotectionauthority.be).
        </p>
      </Section>

      <Section title="7. Cookies">
        <p>
          We use one strictly necessary cookie to keep you signed in, and store your theme and
          language choice. No advertising or third-party tracking cookies are used.
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
