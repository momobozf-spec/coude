'use client'

import { useCallback, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, BookOpen, Check, Sparkles, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { completeLessonAction } from '@/modules/learn/actions'
import { ExerciseGame, fill, isAnswerCorrect, isAnswered, type GameLabels } from '@/modules/learn/games'
import type { AnswerValue } from '@/lib/learn/grading'
import type { CompletionResult, LessonView } from '@/server/modules/learn/learn.service'
import { cn } from '@/lib/utils'

/**
 * Translated strings, resolved on the server. Templates keep their `{name}`
 * placeholders and are filled here with {@link fill}.
 */
export interface LessonPlayerLabels extends GameLabels {
  draftBadge: string
  draftNotice: string
  englishFallback: string
  minutes: string
  readFirst: string
  toQuestions: string
  sources: string
  question: string
  check: string
  correct: string
  incorrect: string
  continue: string
  finish: string
  saving: string
  resultTitle: string
  resultScore: string
  xpEarned: string
  noXpReplay: string
  rhythmDays: string
  rhythmHint: string
  next: string
  backToPath: string
  errorSave: string
  limitReached: string
  upgrade: string
  levelUp: string
  /** Names of levels 1–3. */
  levelNames: string[]
}

type Stage = 'read' | 'quiz' | 'done'

interface LessonPlayerProps {
  lesson: LessonView
  labels: LessonPlayerLabels
  /** The member's locale has no lesson text; English is shown. */
  showFallbackNotice: boolean
  nextSlug: string | null
}

export function LessonPlayer({ lesson, labels, showFallbackNotice, nextSlug }: LessonPlayerProps) {
  const [stage, setStage] = useState<Stage>('read')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [checked, setChecked] = useState(false)
  // Exercises whose timer ran out: they can be checked with whatever was given.
  const [timedOut, setTimedOut] = useState<ReadonlySet<string>>(new Set())
  const [result, setResult] = useState<CompletionResult | null>(null)
  const [error, setError] = useState<{ message: string; limit: boolean } | null>(null)
  const [pending, startTransition] = useTransition()

  const exercise = lesson.exercises[index]
  const total = lesson.exercises.length
  const isLast = index === total - 1
  const kids = lesson.audience === 'kids'
  const exerciseId = exercise?.id

  const markTimedOut = useCallback(() => {
    if (!exerciseId) return
    setTimedOut((current) => (current.has(exerciseId) ? current : new Set(current).add(exerciseId)))
  }, [exerciseId])

  function setAnswer(value: AnswerValue | undefined) {
    if (!exercise || checked) return
    setAnswers((current) => {
      const next = { ...current }
      if (value === undefined) delete next[exercise.id]
      else next[exercise.id] = value
      return next
    })
  }

  function finish(finalAnswers: Record<string, AnswerValue>) {
    setError(null)
    startTransition(async () => {
      const response = await completeLessonAction({ slug: lesson.slug, answers: finalAnswers })
      if (response.ok) {
        setResult(response.data)
        setStage('done')
      } else if (response.code === 'ENTITLEMENT_REQUIRED') {
        setError({ message: labels.limitReached, limit: true })
      } else {
        setError({ message: labels.errorSave, limit: false })
      }
    })
  }

  function advance() {
    if (!exercise) return
    // A round that ran out of time still counts what was answered.
    const finalAnswers =
      answers[exercise.id] === undefined && exercise.type === 'quickfire'
        ? { ...answers, [exercise.id]: [] }
        : answers
    if (!checked) {
      setAnswers(finalAnswers)
      setChecked(true)
      return
    }
    if (isLast) {
      finish(finalAnswers)
      return
    }
    setIndex((current) => current + 1)
    setChecked(false)
  }

  // ── Read ────────────────────────────────────────────────────────────────────
  if (stage === 'read') {
    return (
      <article className="mx-auto max-w-2xl space-y-5">
        <Notices lesson={lesson} labels={labels} showFallbackNotice={showFallbackNotice} />

        <header>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen className="size-3.5" aria-hidden />
            {fill(labels.minutes, { minutes: lesson.minutes })}
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
            {lesson.title}
          </h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
            {lesson.intro}
          </p>
        </header>

        {lesson.key ? (
          <Card variant="sunken" className="p-5 text-center">
            <p lang="ar" dir="rtl" className="text-balance text-xl leading-loose">
              {lesson.key.arabic}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{lesson.key.reference}</p>
          </Card>
        ) : null}

        <div className="space-y-4 text-[0.9375rem] leading-relaxed">
          {lesson.body.map((paragraph, position) => (
            <p key={position}>{paragraph}</p>
          ))}
        </div>

        <Card className="border-primary/30 bg-primary-subtle p-5">
          <p className="text-sm font-medium leading-relaxed text-primary-subtle-foreground">
            {lesson.takeaway}
          </p>
        </Card>

        <Sources lesson={lesson} labels={labels} />

        <div className="flex flex-col items-stretch gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{labels.readFirst}</p>
          <Button size="lg" onClick={() => setStage('quiz')}>
            {labels.toQuestions}
            <ArrowRight />
          </Button>
        </div>
      </article>
    )
  }

  // ── Done ────────────────────────────────────────────────────────────────────
  if (stage === 'done' && result) {
    return (
      <div className="mx-auto max-w-md space-y-5 text-center">
        <Card className="p-6">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-subtle">
            <Check className="size-5 text-primary" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-[-0.025em]">
            {labels.resultTitle}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {fill(labels.resultScore, { correct: result.correct, total: result.total })}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 text-start">
            <div className="rounded-lg border border-border p-3">
              <p className="text-lg font-semibold tabular-nums">
                {result.firstTime ? fill(labels.xpEarned, { xp: result.xpAwarded }) : '—'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">XP</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-lg font-semibold tabular-nums">{result.rhythm.current}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {fill(labels.rhythmDays, { days: result.rhythm.current })}
              </p>
            </div>
          </div>

          {result.leveledUp ? (
            <p className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-primary-subtle px-3 py-2 text-sm font-medium text-primary-subtle-foreground">
              <Sparkles className="size-4" aria-hidden />
              {fill(labels.levelUp, { level: labels.levelNames[result.level - 1] ?? result.level })}
            </p>
          ) : null}

          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            {result.firstTime ? labels.rhythmHint : labels.noXpReplay}
          </p>
        </Card>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {(result.nextSlug ?? nextSlug) ? (
            <Button asChild size="lg">
              <Link href={`/app/learn/${result.nextSlug ?? nextSlug}`}>
                {labels.next}
                <ArrowRight />
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="secondary" size="lg">
            <Link href="/app/learn">{labels.backToPath}</Link>
          </Button>
        </div>
      </div>
    )
  }

  // ── Quiz ────────────────────────────────────────────────────────────────────
  if (!exercise) return null
  const answer = answers[exercise.id]
  const answered = isAnswered(exercise, answer, timedOut.has(exercise.id))
  const correct = checked && isAnswerCorrect(exercise, answer)

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-foreground"
            onClick={() => setStage('read')}
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            {lesson.title}
          </button>
          <span className="tabular-nums">
            {fill(labels.question, { current: index + 1, total })}
          </span>
        </div>
        <Progress value={((index + (checked ? 1 : 0)) / total) * 100} />
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className={cn('font-medium leading-relaxed', kids ? 'text-lg' : 'text-base')}>{exercise.prompt}</h2>

        <div className="mt-4">
          <ExerciseGame
            key={exercise.id}
            exercise={exercise}
            seed={`${lesson.slug}:${exercise.id}`}
            answer={answer}
            checked={checked}
            labels={labels}
            kids={kids}
            onChange={setAnswer}
            onDone={markTimedOut}
          />
        </div>

        {checked ? (
          <div
            role="status"
            className={cn(
              'mt-5 rounded-lg p-4 text-sm leading-relaxed',
              correct ? 'bg-success-subtle' : 'bg-warning-subtle',
            )}
          >
            <p className={cn('flex items-center gap-1.5 font-medium', correct ? 'text-success' : 'text-warning')}>
              {correct ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
              {correct ? labels.correct : labels.incorrect}
            </p>
            <p className="mt-1 text-foreground">{exercise.explanation}</p>
          </div>
        ) : null}
      </Card>

      {error ? (
        <Card variant="sunken" className="p-4 text-sm">
          <p>{error.message}</p>
          {error.limit ? (
            <Button asChild size="sm" className="mt-3">
              <Link href="/pricing">{labels.upgrade}</Link>
            </Button>
          ) : null}
        </Card>
      ) : null}

      <div className="flex justify-end">
        <Button size={kids ? 'xl' : 'lg'} onClick={advance} disabled={!answered || pending} loading={pending}>
          {pending ? labels.saving : !checked ? labels.check : isLast ? labels.finish : labels.continue}
          {!pending && checked ? <ArrowRight /> : null}
        </Button>
      </div>
    </div>
  )
}

function Notices({
  lesson,
  labels,
  showFallbackNotice,
}: {
  lesson: LessonView
  labels: LessonPlayerLabels
  showFallbackNotice: boolean
}) {
  if (!lesson.isDraft && !showFallbackNotice) return null
  return (
    <div className="space-y-2">
      {lesson.isDraft ? (
        <Card variant="sunken" className="p-4">
          <Badge variant="warning" size="sm">
            {labels.draftBadge}
          </Badge>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{labels.draftNotice}</p>
        </Card>
      ) : null}
      {showFallbackNotice ? (
        <p className="text-xs text-muted-foreground">{labels.englishFallback}</p>
      ) : null}
    </div>
  )
}

function Sources({ lesson, labels }: { lesson: LessonView; labels: LessonPlayerLabels }) {
  return (
    <section aria-labelledby="lesson-sources" className="border-t border-border pt-4">
      <h2 id="lesson-sources" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {labels.sources}
      </h2>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {lesson.sources.map((source) => (
          <li key={source.reference}>{source.reference}</li>
        ))}
      </ul>
    </section>
  )
}
