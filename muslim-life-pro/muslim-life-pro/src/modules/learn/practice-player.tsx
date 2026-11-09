'use client'

import { useCallback, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { submitPracticeAction } from '@/modules/learn/actions'
import { ExerciseGame, fill, isAnswerCorrect, isAnswered, type GameLabels } from '@/modules/learn/games'
import type { AnswerValue } from '@/lib/learn/grading'
import type { PracticeItem, PracticeResult } from '@/server/modules/learn/learn.service'
import { cn } from '@/lib/utils'

export interface PracticeLabels extends GameLabels {
  question: string
  check: string
  correct: string
  incorrect: string
  continue: string
  finish: string
  from: string
  score: string
  remaining: string
  allClear: string
  backToPath: string
  errorSave: string
}

const key = (item: PracticeItem) => `${item.lessonSlug}:${item.exercise.id}`

/** A round of earlier mistakes. Graded again on the server; no XP. */
export function PracticePlayer({
  items,
  kids,
  labels,
}: {
  items: PracticeItem[]
  kids: boolean
  labels: PracticeLabels
}) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [checked, setChecked] = useState(false)
  const [timedOut, setTimedOut] = useState<ReadonlySet<string>>(new Set())
  const [result, setResult] = useState<PracticeResult | null>(null)
  const [error, setError] = useState(false)
  const [pending, startTransition] = useTransition()

  const item = items[index]
  const itemKey = item ? key(item) : null
  const isLast = index === items.length - 1

  const markTimedOut = useCallback(() => {
    if (!itemKey) return
    setTimedOut((current) => (current.has(itemKey) ? current : new Set(current).add(itemKey)))
  }, [itemKey])

  if (result) {
    return (
      <Card className="mx-auto max-w-md p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-subtle">
          <Check className="size-5 text-primary" aria-hidden />
        </span>
        <h2 className="mt-4 font-display text-xl font-semibold">
          {fill(labels.score, { correct: result.correct, total: result.total })}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.remaining > 0 ? fill(labels.remaining, { count: result.remaining }) : labels.allClear}
        </p>
        <Button asChild size="lg" className="mt-5">
          <Link href="/app/learn">{labels.backToPath}</Link>
        </Button>
      </Card>
    )
  }

  if (!item || !itemKey) return null
  const answer = answers[itemKey]
  const correct = checked && isAnswerCorrect(item.exercise, answer)

  function setAnswer(value: AnswerValue | undefined) {
    if (!itemKey || checked) return
    setAnswers((current) => {
      const next = { ...current }
      if (value === undefined) delete next[itemKey]
      else next[itemKey] = value
      return next
    })
  }

  function advance() {
    if (!item || !itemKey) return
    const final =
      answers[itemKey] === undefined && item.exercise.type === 'quickfire' ? { ...answers, [itemKey]: [] } : answers
    if (!checked) {
      setAnswers(final)
      setChecked(true)
      return
    }
    if (!isLast) {
      setIndex((current) => current + 1)
      setChecked(false)
      return
    }
    setError(false)
    startTransition(async () => {
      const response = await submitPracticeAction(
        items.map((entry) => ({
          lessonSlug: entry.lessonSlug,
          exerciseId: entry.exercise.id,
          answer: final[key(entry)] ?? [],
        })),
      )
      if (response.ok) {
        setResult(response.data)
        router.refresh()
      } else setError(true)
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="truncate">{fill(labels.from, { title: item.lessonTitle })}</span>
          <span className="tabular-nums">{fill(labels.question, { current: index + 1, total: items.length })}</span>
        </div>
        <Progress value={((index + (checked ? 1 : 0)) / items.length) * 100} />
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className={cn('font-medium leading-relaxed', kids ? 'text-lg' : 'text-base')}>{item.exercise.prompt}</h2>
        <div className="mt-4">
          <ExerciseGame
            key={itemKey}
            exercise={item.exercise}
            seed={`practice:${itemKey}`}
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
            className={cn('mt-5 rounded-lg p-4 text-sm leading-relaxed', correct ? 'bg-success-subtle' : 'bg-warning-subtle')}
          >
            <p className={cn('flex items-center gap-1.5 font-medium', correct ? 'text-success' : 'text-warning')}>
              {correct ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
              {correct ? labels.correct : labels.incorrect}
            </p>
            <p className="mt-1 text-foreground">{item.exercise.explanation}</p>
          </div>
        ) : null}
      </Card>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {labels.errorSave}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          size={kids ? 'xl' : 'lg'}
          onClick={advance}
          disabled={!isAnswered(item.exercise, answer, timedOut.has(itemKey)) || pending}
          loading={pending}
        >
          {!checked ? labels.check : isLast ? labels.finish : labels.continue}
          {!pending && checked ? <ArrowRight /> : null}
        </Button>
      </div>
    </div>
  )
}
