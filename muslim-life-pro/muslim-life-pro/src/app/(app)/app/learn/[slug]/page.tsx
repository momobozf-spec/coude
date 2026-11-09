import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { levelName, playerLabels } from '@/modules/learn/labels'
import { LessonPlayer } from '@/modules/learn/lesson-player'
import { requireActor } from '@/server/auth/actor'
import { getActiveLearner } from '@/server/modules/learn/active-learner'
import { getLessonForPlay } from '@/server/modules/learn/learn.service'
import { NotFoundError } from '@/lib/errors'
import { getTranslations } from '@/i18n/server'

export const metadata: Metadata = {
  title: 'Lesson',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const actor = await requireActor()
  const [tr, learner] = await Promise.all([getTranslations(), getActiveLearner(actor)])

  let state: Awaited<ReturnType<typeof getLessonForPlay>>
  try {
    state = await getLessonForPlay(actor, learner, slug)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  if (state.levelLocked) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Card className="p-6 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted">
            <Lock className="size-4.5 text-muted-foreground" aria-hidden />
          </span>
          <p className="mt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {levelName(tr, state.lesson.level)}
          </p>
          <h1 className="mt-1 font-display text-xl font-semibold">{state.lesson.title}</h1>
          <p className="mt-2 text-sm font-medium">{tr('learn.levelLockedTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{tr('learn.levelLockedBody')}</p>
          <Button asChild variant="secondary" className="mt-5">
            <Link href="/app/learn">{tr('learn.backToPath')}</Link>
          </Button>
        </Card>
      </div>
    )
  }

  if (state.locked) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Card className="p-6 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted">
            <Lock className="size-4.5 text-muted-foreground" aria-hidden />
          </span>
          <h1 className="mt-3 font-display text-xl font-semibold">{state.lesson.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{tr('learn.limitReached')}</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/pricing">{tr('common.upgrade')}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/learn">{tr('learn.backToPath')}</Link>
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // A locale with no lesson text (Arabic, for now) is served English.
  const showFallbackNotice = state.lesson.locale !== tr.locale

  return (
    <div className="space-y-5">
      <Link
        href="/app/learn"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {tr('learn.backToPath')}
      </Link>

      <LessonPlayer
        lesson={state.lesson}
        labels={playerLabels(tr)}
        showFallbackNotice={showFallbackNotice}
        nextSlug={state.nextSlug}
      />
    </div>
  )
}
