import type { Metadata } from 'next'
import Link from 'next/link'
import { Calendar, Globe, Mail, MapPin, Sparkles } from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { requireActor } from '@/server/auth/actor'
import { getPreferences } from '@/server/modules/account/account.service'
import { GOAL_VALUES, INTEREST_VALUES } from '@/server/modules/account/account.schema'
import { prisma } from '@/server/db/prisma'
import { formatDate, utcDateToIsoDate } from '@/lib/dates'
import { initials } from '@/lib/utils'
import { t } from '@/i18n'

export const metadata: Metadata = {
  title: 'Profile',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const INTEREST_LABEL_KEYS: Record<string, string> = {
  FAMILY: 'onboarding.interests.family',
  FITNESS: 'onboarding.interests.fitness',
  LEARNING: 'onboarding.interests.learning',
  BUSINESS: 'onboarding.interests.business',
  TRAVEL: 'onboarding.interests.travel',
  MODEST_FASHION: 'onboarding.interests.modestFashion',
  FOOD: 'onboarding.interests.food',
  FINANCE: 'onboarding.interests.finance',
}

const GOAL_LABEL_KEYS: Record<string, string> = {
  PRAY_CONSISTENTLY: 'onboarding.goals.prayConsistently',
  READ_QURAN: 'onboarding.goals.readQuran',
  PRODUCTIVITY: 'onboarding.goals.productivity',
  SAVE_MONEY: 'onboarding.goals.saveMoney',
  LEARN: 'onboarding.goals.learn',
  BUILD_HABITS: 'onboarding.goals.buildHabits',
  RAMADAN_PREP: 'onboarding.goals.ramadanPrep',
  UMRAH_HAJJ: 'onboarding.goals.umrahHajj',
  FAMILY_ORG: 'onboarding.goals.familyOrg',
}

export default async function ProfilePage() {
  const actor = await requireActor()
  const [preference, user] = await Promise.all([
    getPreferences(actor),
    prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: { createdAt: true },
    }),
  ])

  const isPremium = actor.plan === 'PREMIUM'

  const interests = preference.interests.filter((value) =>
    (INTEREST_VALUES as readonly string[]).includes(value),
  )
  const goals = preference.goals.filter((value) =>
    (GOAL_VALUES as readonly string[]).includes(value),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.profile')}
        action={
          <Button variant="secondary" size="sm" asChild>
            <Link href="/app/settings">{t('nav.settings')}</Link>
          </Button>
        }
      />

      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar className="size-16">
            <AvatarFallback className="text-lg">{initials(actor.name)}</AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
                {actor.name ?? 'Member'}
              </h2>
              <Badge variant={isPremium ? 'accent' : 'default'} size="sm">
                {isPremium ? (
                  <>
                    <Sparkles className="size-3" />
                    {t('common.premium')}
                  </>
                ) : (
                  t('common.free')
                )}
              </Badge>
            </div>

            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Email</dt>
                <Mail className="size-3.5" aria-hidden />
                <dd>{actor.email}</dd>
              </div>
              {preference.city ? (
                <div className="flex items-center gap-1.5">
                  <dt className="sr-only">City</dt>
                  <MapPin className="size-3.5" aria-hidden />
                  <dd>
                    {preference.city.name}
                    {preference.country ? `, ${preference.country.name}` : ''}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Language</dt>
                <Globe className="size-3.5" aria-hidden />
                <dd className="uppercase">{actor.locale}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Member since</dt>
                <Calendar className="size-3.5" aria-hidden />
                <dd>
                  Member since{' '}
                  {formatDate(utcDateToIsoDate(user.createdAt), actor.locale, {
                    month: 'long',
                    year: 'numeric',
                  })}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2">
        <TagCard
          title={t('onboarding.interests.title')}
          values={interests}
          labelKeys={INTEREST_LABEL_KEYS}
        />
        <TagCard title={t('onboarding.goals.title')} values={goals} labelKeys={GOAL_LABEL_KEYS} />
      </div>

      <Card variant="sunken" className="p-5">
        <p className="text-xs leading-relaxed text-muted-foreground">{t('auth.privacyNote')}</p>
      </Card>
    </div>
  )
}

function TagCard({
  title,
  values,
  labelKeys,
}: {
  title: string
  values: string[]
  labelKeys: Record<string, string>
}) {
  return (
    <Card className="p-5">
      <h3 className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {values.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing selected yet.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {values.map((value) => (
            <li key={value}>
              <Badge variant="primary" size="sm">
                {t((labelKeys[value] ?? value) as never)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
