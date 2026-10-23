import type { Metadata } from 'next'
import Link from 'next/link'
import { Bell, CreditCard, Download, Shield, Sparkles } from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { AppearanceSetting } from '@/modules/settings/appearance-setting'
import { LanguageSetting } from '@/modules/settings/language-setting'
import { PrayerSettingsForm } from '@/modules/settings/prayer-settings-form'
import { ChangePasswordForm } from '@/modules/auth/password-forms'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { requireActor } from '@/server/auth/actor'
import { getOnboardingLocations, getPreferences } from '@/server/modules/account/account.service'
import { t } from '@/i18n'

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const actor = await requireActor()
  const [preference, countries] = await Promise.all([
    getPreferences(actor),
    getOnboardingLocations(),
  ])

  const isPremium = actor.plan === 'PREMIUM'

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.settings')}
        description="Prayer calculation, appearance and your data."
      />

      <SettingsSection title={t('theme.label')}>
        <AppearanceSetting />
      </SettingsSection>

      <SettingsSection title={t('language.label')} description={t('language.description')}>
        <LanguageSetting current={actor.locale} />
      </SettingsSection>

      <SettingsSection
        title="Prayer times"
        description="Times are calculated astronomically from your city's coordinates. Adjust the method and madhab to match how you pray."
      >
        <PrayerSettingsForm
          countries={countries.map((country) => ({
            id: country.id,
            code: country.code,
            name: country.name,
            cities: country.cities.map((city) => ({ id: city.id, name: city.name })),
          }))}
          current={{
            countryId: preference.countryId,
            cityId: preference.cityId,
            calculationMethod: preference.calculationMethod,
            madhab: preference.madhab,
          }}
        />
      </SettingsSection>

      <SettingsSection title={t('auth.passwordSection')} description={t('auth.changePasswordIntro')}>
        <Card className="p-5">
          <ChangePasswordForm />
        </Card>
      </SettingsSection>

      <SettingsSection title="Subscription">
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-muted">
              <CreditCard className="size-4 text-muted-foreground" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">
                  {isPremium ? t('pricing.premiumName') : t('pricing.freeName')}
                </p>
                {isPremium ? (
                  <Badge variant="accent" size="sm">
                    <Sparkles className="size-3" />
                    {t('common.premium')}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isPremium
                  ? 'Change your plan, billing interval or payment method.'
                  : 'Unlimited habits, plan generators and more assistant messages.'}
              </p>
            </div>
          </div>

          <Button variant={isPremium ? 'secondary' : 'primary'} size="sm" asChild>
            <Link href="/app/settings/billing">
              {isPremium ? t('pricing.manage') : t('common.upgrade')}
            </Link>
          </Button>
        </Card>
      </SettingsSection>

      <SettingsSection
        title="Privacy and data"
        description="Your prayer and habit data is private by default. It is never shown publicly, never ranked against other members, and never sold."
      >
        <div className="space-y-3">
          <PrivacyRow
            icon={Shield}
            title="Your worship data is private"
            body="There is no public profile, feed or leaderboard anywhere in Muslim Life."
          />
          <PrivacyRow
            icon={Download}
            title="Export, clear or delete your data"
            body="Download everything you've created, clear what you've tracked, or leave entirely."
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/app/settings/privacy">Open</Link>
              </Button>
            }
          />
          <PrivacyRow
            icon={Bell}
            title="Notifications"
            body="Choose what we may send you. Everything optional is off until you turn it on."
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/app/settings/notifications">Open</Link>
              </Button>
            }
          />
        </div>
      </SettingsSection>
    </div>
  )
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold tracking-[-0.01em]">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function PrivacyRow({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: typeof Shield
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </span>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 max-w-md text-xs leading-relaxed text-muted-foreground">{body}</p>
        </div>
      </div>
      {action}
    </Card>
  )
}
