import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { NewChildForm } from '@/modules/learn/profile-forms'
import { requireActor } from '@/server/auth/actor'
import { listLearners, MAX_CHILD_PROFILES } from '@/server/modules/learn/learner.service'
import { getTranslations } from '@/i18n/server'

export const metadata: Metadata = {
  title: 'Add a child',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function NewChildPage() {
  const actor = await requireActor()
  const [learners, tr] = await Promise.all([listLearners(actor), getTranslations()])
  const full = learners.filter((learner) => learner.kind === 'CHILD').length >= MAX_CHILD_PROFILES

  return (
    <div className="mx-auto max-w-md space-y-5">
      <Link
        href="/app/learn"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {tr('learn.backToPath')}
      </Link>

      <header>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.025em]">{tr('learn.newChildTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tr('learn.newChildDescription')}</p>
      </header>

      <Card className="p-5 sm:p-6">
        {full ? (
          <p className="text-sm text-muted-foreground">{tr('learn.childLimit', { max: MAX_CHILD_PROFILES })}</p>
        ) : (
          <NewChildForm
            labels={{
              childName: tr('learn.childName'),
              childNameHint: tr('learn.childNameHint'),
              ageGroup: tr('learn.ageGroup'),
              ageKids: tr('learn.ageKids'),
              ageTeens: tr('learn.ageTeens'),
              createChild: tr('learn.createChild'),
              childPrivacy: tr('learn.childPrivacy'),
              childLimit: tr('learn.childLimit', { max: MAX_CHILD_PROFILES }),
              errorProfile: tr('learn.errorProfile'),
            }}
          />
        )}
      </Card>
    </div>
  )
}
