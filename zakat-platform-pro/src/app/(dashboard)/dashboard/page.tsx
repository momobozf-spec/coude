import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check, Circle } from 'lucide-react'

import {
  Badge,
  ButtonLink,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from '@/components/ui'
import { requireActorOrRedirect } from '@/server/auth/guards'
import { getDashboardSummary } from '@/server/modules/dashboard/service'
import { formatDecimal, formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/dates'

export const metadata: Metadata = { title: 'Overzicht' }

const DONATION_LABELS: Record<string, string> = {
  ZAKAT: 'Zakat',
  SADAQAH: 'Sadaqah',
  SADAQAH_JARIYAH: 'Sadaqah Jariyah',
  FIDYA: 'Fidya',
  KAFFARAH: 'Kaffarah',
  WAQF: 'Waqf',
  OTHER: 'Overig',
}

export default async function DashboardPage() {
  const actor = await requireActorOrRedirect()
  const summary = await getDashboardSummary(actor)

  const firstName = actor.name?.split(' ')[0]

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm text-muted">Assalamu alaikum{firstName ? `, ${firstName}` : ''}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Overzicht</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Mijn Zakat</CardTitle>
          <CardDescription>
            {summary.nextZakatDate
              ? `Volgende Zakat-datum: ${formatDate(summary.nextZakatDate)}`
              : 'Stel je jaarlijkse Zakat-datum in om je volgende moment te volgen.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {summary.latestCalculation ? (
            <div>
              <p className="text-sm text-muted">
                {summary.latestCalculation.status === 'FINALIZED'
                  ? 'Vastgelegde Zakat'
                  : 'Geschatte Zakat'}
              </p>
              <p className="tabular mt-0.5 text-2xl font-semibold">
                {formatMoney(
                  summary.latestCalculation.zakatDueMinor,
                  summary.latestCalculation.currency,
                )}
              </p>
              {summary.latestCalculation.status === 'DRAFT' ? (
                <p className="mt-1 text-xs text-muted">
                  Concept — stap {summary.latestCalculation.wizardStep} van 8
                </p>
              ) : summary.latestCalculation.paidMinor !== null ? (
                <p className="mt-1 text-xs text-muted">
                  {formatMoney(
                    summary.latestCalculation.paidMinor,
                    summary.latestCalculation.currency,
                  )}{' '}
                  betaald
                  {summary.latestCalculation.remainingMinor
                    ? ` · nog ${formatMoney(summary.latestCalculation.remainingMinor, summary.latestCalculation.currency)}`
                    : ''}
                </p>
              ) : null}
            </div>
          ) : null}

          {summary.nextZakatHijri ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{summary.nextZakatHijri}</Badge>
              {summary.daysUntilZakat !== null ? (
                <span className="text-sm text-muted">nog {summary.daysUntilZakat} dagen</span>
              ) : null}
            </div>
          ) : null}

          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Berekening {summary.completeness}% compleet</span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted"
              role="progressbar"
              aria-valuenow={summary.completeness}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Volledigheid van je Zakat-berekening"
            >
              <div className="h-full bg-primary" style={{ width: `${summary.completeness}%` }} />
            </div>
          </div>

          <ul className="flex flex-col gap-1.5">
            {summary.checklist.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-muted"
                >
                  {item.done ? (
                    <Check className="size-4 text-success" aria-hidden />
                  ) : (
                    <Circle className="size-4 text-muted" aria-hidden />
                  )}
                  <span className={item.done ? 'text-muted line-through' : ''}>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>

          <ButtonLink href="/zakat" className="self-start">
            Naar mijn berekening
            <ArrowRight className="size-4" aria-hidden />
          </ButtonLink>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Dit jaar gedoneerd"
          value={formatMoney(summary.donatedThisYearMinor, summary.currency)}
        />
        <StatCard
          label="Zakat betaald"
          value={formatMoney(summary.zakatPaidThisYearMinor, summary.currency)}
        />
        <StatCard
          label="Sadaqah dit jaar"
          value={formatMoney(summary.sadaqahThisYearMinor, summary.currency)}
          hint={`Deze maand ${formatMoney(summary.sadaqahThisMonthMinor, summary.currency)}`}
        />
      </div>

      {summary.sadaqahGoals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sadaqah-doelen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {summary.sadaqahGoals.map((goal) => (
              <div key={goal.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{goal.label ?? 'Mijn Sadaqah-doel'}</span>
                  <span className="tabular font-medium">
                    {formatMoney(goal.achievedMinor, goal.currency)} van{' '}
                    {formatMoney(goal.targetMinor, goal.currency)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full bg-primary" style={{ width: `${goal.percentage}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {summary.unconvertedRecords > 0 ? (
        <Card className="border-warning/40 bg-warning-subtle/40">
          <CardContent className="pt-5 text-sm">
            {summary.unconvertedRecords} donatie(s) staan in een andere valuta dan{' '}
            {summary.currency} en tellen nog niet mee in de totalen. Omrekenen komt met de
            wisselkoersmodule.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recente donaties</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.recentDonations.length === 0 ? (
            <EmptyState
              title="Nog geen donaties"
              description="Registreer wat je geeft, dan bouw je vanzelf een jaaroverzicht op."
              action={
                <ButtonLink href="/donations" size="sm">
                  Donatie toevoegen
                </ButtonLink>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {summary.recentDonations.map((donation) => (
                <li key={donation.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{donation.recipient}</p>
                    <p className="text-xs text-muted">
                      {DONATION_LABELS[donation.type] ?? donation.type} ·{' '}
                      {formatDate(donation.donatedAt)}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-sm font-medium">
                    {formatDecimal(donation.amount, donation.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-muted">{label}</p>
        <p className="tabular mt-1 text-xl font-semibold">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
