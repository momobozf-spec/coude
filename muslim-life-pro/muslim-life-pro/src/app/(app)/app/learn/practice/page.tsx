import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { gameLabels } from '@/modules/learn/labels'
import { PracticePlayer } from '@/modules/learn/practice-player'
import { requireActor } from '@/server/auth/actor'
import { getActiveLearner } from '@/server/modules/learn/active-learner'
import { getPracticeSet } from '@/server/modules/learn/learn.service'
import { getTranslations } from '@/i18n/server'

export const metadata: Metadata = {
  title: 'Practice',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function PracticePage() {
  const actor = await requireActor()
  const [learner, tr] = await Promise.all([getActiveLearner(actor), getTranslations()])
  const items = await getPracticeSet(actor, learner)

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
        <h1 className="font-display text-2xl font-semibold tracking-[-0.025em]">{tr('learn.practiceTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tr('learn.practiceDescription')}</p>
      </header>

      {items.length === 0 ? (
        <Card className="mx-auto max-w-2xl p-6 text-center text-sm text-muted-foreground">
          {tr('learn.practiceEmpty')}
        </Card>
      ) : (
        <PracticePlayer
          items={items}
          kids={learner.audience === 'kids'}
          labels={{
            ...gameLabels(tr),
            question: tr('learn.question', { current: '{current}', total: '{total}' }),
            check: tr('learn.check'),
            correct: tr('learn.correct'),
            incorrect: tr('learn.incorrect'),
            continue: tr('learn.continue'),
            finish: tr('learn.continue'),
            from: tr('learn.practiceFrom', { title: '{title}' }),
            score: tr('learn.practiceScore', { correct: '{correct}', total: '{total}' }),
            remaining: tr('learn.practiceRemaining', { count: '{count}' }),
            allClear: tr('learn.practiceAllClear'),
            backToPath: tr('learn.backToPath'),
            errorSave: tr('learn.errorSave'),
          }}
        />
      )}
    </div>
  )
}
