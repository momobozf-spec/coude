import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { levelName } from '@/modules/learn/labels'
import { PlacementQuiz } from '@/modules/learn/profile-forms'
import { requireActor } from '@/server/auth/actor'
import { getActiveLearner } from '@/server/modules/learn/active-learner'
import { lessonLocaleFor } from '@/lib/learn/lesson-schema'
import { placementFor } from '@/server/modules/learn/learner.service'
import { getTranslations } from '@/i18n/server'

export const metadata: Metadata = {
  title: 'Level test',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function PlacementPage() {
  const actor = await requireActor()
  const [learner, tr] = await Promise.all([getActiveLearner(actor), getTranslations()])
  const questions = placementFor(learner, lessonLocaleFor(actor.locale))

  return (
    <div className="space-y-5">
      <Link
        href="/app/learn"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {tr('learn.backToPath')}
      </Link>

      <header className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.025em]">{tr('learn.placementTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tr('learn.placementIntro')}</p>
      </header>

      <PlacementQuiz
        learnerId={learner.id}
        questions={questions}
        labels={{
          question: tr('learn.question', { current: '{current}', total: '{total}' }),
          continue: tr('learn.continue'),
          finish: tr('learn.check'),
          skip: tr('learn.placementSkip'),
          result: tr('learn.placementResult', { correct: '{correct}', total: '{total}' }),
          level: tr('learn.placementLevel', { level: '{level}' }),
          cta: tr('learn.placementCta'),
          levelNames: [1, 2, 3].map((level) => levelName(tr, level)),
          errorSave: tr('learn.errorSave'),
        }}
      />
    </div>
  )
}
