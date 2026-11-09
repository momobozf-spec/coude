import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check, Flame, GraduationCap, Lock, RotateCcw } from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { requireActor } from '@/server/auth/actor'
import { rhythmLine } from '@/modules/learn/rhythm-line'
import { ageGroupName, gameName, levelName } from '@/modules/learn/labels'
import { LearnerSwitcher, SkipPlacementButton } from '@/modules/learn/learner-switcher'
import { RemoveChildButton } from '@/modules/learn/profile-forms'
import { getActiveLearner } from '@/server/modules/learn/active-learner'
import { getLearnOverview, PRACTICE_SET_SIZE } from '@/server/modules/learn/learn.service'
import { listLearners, MAX_CHILD_PROFILES } from '@/server/modules/learn/learner.service'
import { getTranslations } from '@/i18n/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Learn',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function LearnPage() {
  const actor = await requireActor()
  const [active, learners, tr] = await Promise.all([
    getActiveLearner(actor),
    listLearners(actor),
    getTranslations(),
  ])
  const overview = await getLearnOverview(actor, active)
  const { rhythm, learner } = overview
  const kids = learner.audience === 'kids'
  const childCount = learners.filter((entry) => entry.kind === 'CHILD').length

  return (
    <div className="space-y-6">
      <PageHeader title={tr('learn.title')} description={tr('learn.description')} />

      <LearnerSwitcher
        learners={learners.map((entry) => ({
          id: entry.id,
          label: entry.kind === 'SELF' ? tr('learn.me') : (entry.name ?? ''),
          detail: `${ageGroupName(tr, entry.ageGroup)} · ${levelName(tr, entry.level)}`,
        }))}
        activeId={learner.id}
        canAddChild={childCount < MAX_CHILD_PROFILES}
        labels={{ whoLearns: tr('learn.whoLearns'), addChild: tr('learn.addChild') }}
      />

      {!learner.placed && overview.totalCount > 0 ? (
        <Card className="border-primary/30 bg-primary-subtle p-5">
          <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">
            {tr('learn.placementSetupTitle')}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{tr('learn.placementSetupBody')}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link href="/app/learn/placement">
                {tr('learn.placementStart')}
                <ArrowRight />
              </Link>
            </Button>
            <SkipPlacementButton learnerId={learner.id} label={tr('learn.placementSkip')} />
          </div>
        </Card>
      ) : null}

      {overview.hasDrafts ? (
        <Card variant="sunken" className="p-4">
          <Badge variant="warning" size="sm">
            {tr('learn.draftBadge')}
          </Badge>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {tr('learn.draftNotice')}
          </p>
        </Card>
      ) : null}

      {overview.totalCount === 0 ? (
        <Card className="p-6 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted">
            <GraduationCap className="size-4.5 text-muted-foreground" aria-hidden />
          </span>
          <p className="mt-3 text-sm text-muted-foreground">{tr('learn.noLessons')}</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Rhythm */}
            <Card className="p-5">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Flame className="size-3.5" aria-hidden />
                {tr('learn.rhythm')}
              </p>
              <p className="mt-3 font-display text-3xl font-semibold tabular-nums">
                {rhythm.current}
              </p>
              <p className="text-sm text-muted-foreground">
                {tr('learn.rhythmDays', { days: rhythm.current })}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {rhythmLine(tr, rhythm)} {rhythm.best > 0 ? tr('learn.best', { days: rhythm.best }) : ''}
              </p>
            </Card>

            {/* Level */}
            <Card className="p-5">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <GraduationCap className="size-3.5" aria-hidden />
                {levelName(tr, learner.level)}
              </p>
              <p className="mt-3 font-display text-3xl font-semibold tabular-nums">
                {tr('learn.xp', { xp: overview.xp })}
              </p>
              <Progress
                className="mt-3"
                value={overview.totalCount === 0 ? 0 : (overview.completedCount / overview.totalCount) * 100}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {tr('learn.progress', {
                  completed: overview.completedCount,
                  total: overview.totalCount,
                })}
              </p>
            </Card>
          </div>

          {/* Next up */}
          <Card className="p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {tr('learn.nextUp')}
            </p>
            {overview.nextLesson ? (
              <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
                    {overview.nextLesson.title}
                  </h2>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                    {overview.nextLesson.intro}
                  </p>
                </div>
                {overview.atDailyLimit ? (
                  <div className="max-w-xs text-xs text-muted-foreground">
                    <p>{tr('learn.limitReached')}</p>
                    <Button asChild size="sm" className="mt-2">
                      <Link href="/pricing">{tr('common.upgrade')}</Link>
                    </Button>
                  </div>
                ) : (
                  <Button asChild size="lg">
                    <Link href={`/app/learn/${overview.nextLesson.slug}`}>
                      {tr('learn.start')}
                      <ArrowRight />
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{tr('learn.allDone')}</p>
            )}
            {overview.newLimit !== null ? (
              <p className="mt-4 text-xs text-muted-foreground">
                {tr('learn.dailyLimit', { used: overview.newToday, limit: overview.newLimit })}
              </p>
            ) : null}
          </Card>

          {overview.practiceCount > 0 ? (
            <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <RotateCcw className="size-4 text-primary" aria-hidden />
                  {tr('learn.practiceTitle')}
                </p>
                <p className="mt-1 max-w-md text-xs text-muted-foreground">{tr('learn.practiceDescription')}</p>
              </div>
              <Button asChild variant="secondary">
                <Link href="/app/learn/practice">
                  {tr('learn.practiceCta', { count: Math.min(overview.practiceCount, PRACTICE_SET_SIZE) })}
                </Link>
              </Button>
            </Card>
          ) : null}

          {/* Path */}
          <div className="space-y-5">
            {overview.levels.map((group) => (
              <section key={group.level} aria-labelledby={`level-${group.level}`}>
                <h2 id={`level-${group.level}`} className="flex items-center gap-2 text-sm font-medium">
                  {levelName(tr, group.level)}
                  {group.level > learner.level ? (
                    <Lock className="size-3.5 text-muted-foreground" aria-label={tr('learn.lockedBadge')} />
                  ) : null}
                </h2>

                {group.lessons.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">{tr('learn.comingSoon')}</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {group.lessons.map((lesson, position) => {
                      const games = [...new Set(lesson.games)]
                        .map((type) => gameName(tr, type, kids))
                        .filter((name): name is string => name !== null)
                      return (
                        <li key={lesson.slug}>
                          <Link
                            href={`/app/learn/${lesson.slug}`}
                            className={cn(
                              'flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong hover:bg-muted',
                              lesson.locked && 'opacity-60',
                            )}
                          >
                            <span
                              className={cn(
                                'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums',
                                lesson.completed
                                  ? 'border-transparent bg-primary text-primary-foreground'
                                  : 'border-border text-muted-foreground',
                              )}
                              aria-hidden
                            >
                              {lesson.completed ? (
                                <Check className="size-3.5" />
                              ) : lesson.locked ? (
                                <Lock className="size-3" />
                              ) : (
                                position + 1
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{lesson.title}</span>
                              <span className="block text-xs text-muted-foreground">
                                {tr('learn.minutes', { minutes: lesson.minutes })}
                                {games.length > 0 ? ` · ${games.join(', ')}` : ''}
                                {lesson.completed ? ` · ${tr('learn.completed')}` : ''}
                              </span>
                            </span>
                            {lesson.isDraft ? (
                              <Badge variant="warning" size="sm" className="hidden sm:inline-flex">
                                {tr('learn.draftBadge')}
                              </Badge>
                            ) : null}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </>
      )}
      {learner.kind === 'CHILD' ? (
        <div className="border-t border-border pt-4">
          <RemoveChildButton
            learnerId={learner.id}
            labels={{ removeChild: tr('learn.removeChild'), removeChildHint: tr('learn.removeChildHint') }}
          />
        </div>
      ) : null}
    </div>
  )
}
