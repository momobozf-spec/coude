import type { Metadata } from 'next'
import { Check, Minus } from 'lucide-react'

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  ButtonLink,
  CardDescription,
  CardTitle,
  PageHeader,
} from '@/components/ui'
import { SignOutButton } from '@/modules/auth/sign-out-button'
import {
  ChangePasswordForm,
  DeleteAccountForm,
  EmailRemindersToggle,
  RevokeSessionsButton,
} from '@/modules/auth/account-forms'
import { accountSecurityInfo } from '@/server/modules/account/service'
import { emailConfigured } from '@/server/integrations/email'
import { requireActorOrRedirect } from '@/server/auth/guards'
import { entitlementSnapshot } from '@/server/services/entitlements'
import { PLANS, PLAN_ORDER } from '@/config/plans'
import { getCurrency } from '@/config/currencies'

export const metadata: Metadata = { title: 'Profiel' }

const FEATURE_LABELS: Record<string, string> = {
  UNLIMITED_CALCULATIONS: 'Onbeperkt berekenen',
  CALCULATION_HISTORY: 'Berekeningshistorie',
  ADVANCED_ASSETS: 'Uitgebreide vermogenscategorieën',
  MULTI_CURRENCY: 'Meerdere valuta',
  BUSINESS_ASSETS: 'Zakelijke activa',
  YEARLY_REPORTS: 'Jaarrapporten',
  REPORT_EXPORT: 'Rapport exporteren',
  AI_EXPLANATIONS: 'AI-uitleg bij je berekening',
  AI_ASSISTANT: 'AI-assistent',
  RECEIPT_UPLOAD: 'Bewijsstukken uploaden',
  HOUSEHOLD: 'Huishouden',
  HOUSEHOLD_SHARED_DASHBOARD: 'Gedeeld gezinsdashboard',
  CUSTOM_REMINDERS: 'Eigen herinneringen',
  ORGANIZATION_TEAM: 'Teamaccounts',
  AUDIT_EXPORT: 'Audit-export',
}

export default async function ProfilePage() {
  const actor = await requireActorOrRedirect()
  const entitlements = entitlementSnapshot(actor)
  const currency = getCurrency(actor.defaultCurrency)
  const security = await accountSecurityInfo(actor)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Profiel" description="Je account, abonnement en Zakat-instellingen." />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Row label="Naam" value={actor.name ?? '—'} />
          <Row label="E-mailadres" value={actor.email} />
          <Row
            label="Valuta"
            value={currency ? `${currency.code} — ${currency.name}` : actor.defaultCurrency}
          />
          <Row label="Tijdzone" value={actor.timezone} />
          <div className="flex flex-wrap gap-2 pt-2">
            <ButtonLink href="/onboarding" variant="secondary" size="sm">
              Zakat-instellingen wijzigen
            </ButtonLink>
            <SignOutButton />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Abonnement</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Badge tone={actor.plan === 'FREE' ? 'neutral' : 'success'}>
              {entitlements.planName}
            </Badge>
            <span className="text-sm text-muted">{PLANS[actor.plan].description}</span>
          </div>

          <ul className="flex flex-col gap-1.5">
            {Object.entries(entitlements.features).map(([feature, enabled]) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                {enabled ? (
                  <Check className="size-4 shrink-0 text-success" aria-hidden />
                ) : (
                  <Minus className="size-4 shrink-0 text-muted" aria-hidden />
                )}
                <span className={enabled ? '' : 'text-muted'}>
                  {FEATURE_LABELS[feature] ?? feature}
                </span>
              </li>
            ))}
          </ul>

          <div className="border-t border-border pt-3">
            <p className="text-sm font-medium">Beschikbare abonnementen</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm text-muted">
              {PLAN_ORDER.map((plan) => (
                <li key={plan}>
                  <span className="font-medium text-foreground">{PLANS[plan].name}</span> —{' '}
                  {PLANS[plan].description}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meldingen</CardTitle>
        </CardHeader>
        <CardContent>
          <EmailRemindersToggle initial={security.emailReminders} available={emailConfigured()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Beveiliging</CardTitle>
          <CardDescription>
            Na een wachtwoordwijziging of &laquo;overal afmelden&raquo; moet je op elk toestel
            opnieuw inloggen.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {security.hasPassword ? (
            <ChangePasswordForm />
          ) : (
            <p className="text-sm text-muted">Je logt in via Google; er is geen wachtwoord om te wijzigen.</p>
          )}
          <div className="border-t border-border pt-4">
            <p className="mb-2 text-sm text-muted">
              Ergens ingelogd gebleven op een toestel dat je niet vertrouwt?
            </p>
            <RevokeSessionsButton />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Je gegevens</CardTitle>
          <CardDescription>
            Je hebt recht op inzage in en verwijdering van alles wat we over je bewaren.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div>
            <a
              href="/api/account/export"
              className="inline-flex h-9 items-center rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted"
            >
              Mijn gegevens downloaden (JSON)
            </a>
          </div>
          <div className="border-t border-border pt-4">
            <DeleteAccountForm hasPassword={security.hasPassword} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
