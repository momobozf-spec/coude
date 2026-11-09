'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  createChildAction,
  deleteChildAction,
  skipPlacementAction,
  submitPlacementAction,
} from '@/modules/learn/actions'
import { fill } from '@/modules/learn/games'
import { shuffledIndices } from '@/modules/learn/shuffle'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// New child profile
// ─────────────────────────────────────────────────────────────────────────────

export function NewChildForm({
  labels,
}: {
  labels: {
    childName: string
    childNameHint: string
    ageGroup: string
    ageKids: string
    ageTeens: string
    createChild: string
    childPrivacy: string
    childLimit: string
    errorProfile: string
  }
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [ageGroup, setAgeGroup] = useState<'KIDS' | 'TEENS'>('KIDS')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const response = await createChildAction({ name, ageGroup })
      if (response.ok) {
        router.push('/app/learn')
        router.refresh()
      } else {
        setError(response.code === 'CONFLICT' ? labels.childLimit : labels.errorProfile)
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="child-name">{labels.childName}</Label>
        <Input
          id="child-name"
          value={name}
          maxLength={30}
          autoComplete="off"
          required
          onChange={(event) => setName(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">{labels.childNameHint}</p>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">{labels.ageGroup}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['KIDS', labels.ageKids],
              ['TEENS', labels.ageTeens],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={ageGroup === value}
              className={cn(
                'rounded-lg border px-4 py-3 text-sm transition-colors',
                ageGroup === value ? 'border-primary bg-primary-subtle font-medium' : 'border-border hover:bg-muted',
              )}
              onClick={() => setAgeGroup(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <p className="text-xs leading-relaxed text-muted-foreground">{labels.childPrivacy}</p>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" loading={pending} disabled={pending || name.trim().length === 0}>
        {labels.createChild}
      </Button>
    </form>
  )
}

/** Two taps to remove: the first asks, the second deletes. No browser dialog. */
export function RemoveChildButton({
  learnerId,
  labels,
}: {
  learnerId: string
  labels: { removeChild: string; removeChildHint: string }
}) {
  const router = useRouter()
  const [armed, setArmed] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant={armed ? 'danger' : 'ghost'}
        size="sm"
        loading={pending}
        disabled={pending}
        onClick={() => {
          if (!armed) {
            setArmed(true)
            return
          }
          startTransition(async () => {
            const response = await deleteChildAction({ learnerId })
            if (response.ok) router.refresh()
          })
        }}
      >
        <Trash2 />
        {labels.removeChild}
      </Button>
      {armed ? <p className="text-xs text-muted-foreground">{labels.removeChildHint}</p> : null}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Placement quiz
// ─────────────────────────────────────────────────────────────────────────────

export interface PlacementQuizLabels {
  question: string
  continue: string
  finish: string
  skip: string
  result: string
  level: string
  cta: string
  levelNames: string[]
  errorSave: string
}

export function PlacementQuiz({
  learnerId,
  questions,
  labels,
}: {
  learnerId: string
  questions: { id: string; prompt: string; options: string[] }[]
  labels: PlacementQuizLabels
}) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [result, setResult] = useState<{ correct: number; total: number; level: number } | null>(null)
  const [error, setError] = useState(false)
  const [pending, startTransition] = useTransition()

  const question = questions[index]
  const order = useMemo(
    () => (question ? shuffledIndices(question.options.length, `placement:${question.id}`) : []),
    [question],
  )

  if (result) {
    return (
      <Card className="mx-auto max-w-md p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-subtle">
          <Check className="size-5 text-primary" aria-hidden />
        </span>
        <p className="mt-4 text-sm text-muted-foreground">
          {fill(labels.result, { correct: result.correct, total: result.total })}
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold">
          {fill(labels.level, { level: labels.levelNames[result.level - 1] ?? result.level })}
        </h2>
        <Button asChild size="lg" className="mt-5">
          <Link href="/app/learn">
            {labels.cta}
            <ArrowRight />
          </Link>
        </Button>
      </Card>
    )
  }

  if (!question) return null
  const chosen = answers[question.id]
  const isLast = index === questions.length - 1

  function next() {
    if (!isLast) {
      setIndex((current) => current + 1)
      return
    }
    setError(false)
    startTransition(async () => {
      const response = await submitPlacementAction({ learnerId, answers })
      if (response.ok) {
        setResult(response.data)
        router.refresh()
      } else setError(true)
    })
  }

  function skip() {
    startTransition(async () => {
      const response = await skipPlacementAction({ learnerId })
      if (response.ok) {
        router.push('/app/learn')
        router.refresh()
      } else setError(true)
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-2">
        <p className="text-end text-xs tabular-nums text-muted-foreground">
          {fill(labels.question, { current: index + 1, total: questions.length })}
        </p>
        <Progress value={(index / questions.length) * 100} />
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-medium leading-relaxed">{question.prompt}</h2>
        <div className="mt-4 space-y-2" role="radiogroup" aria-label={question.prompt}>
          {order.map((optionIndex) => (
            <button
              key={optionIndex}
              type="button"
              role="radio"
              aria-checked={chosen === optionIndex}
              className={cn(
                'w-full rounded-lg border px-4 py-3 text-start text-sm transition-colors',
                chosen === optionIndex ? 'border-primary bg-primary-subtle' : 'border-border hover:bg-muted',
              )}
              onClick={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
            >
              {question.options[optionIndex]}
            </button>
          ))}
        </div>
      </Card>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {labels.errorSave}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={skip} disabled={pending}>
          {labels.skip}
        </Button>
        <Button size="lg" onClick={next} disabled={chosen === undefined || pending} loading={pending}>
          {isLast ? labels.finish : labels.continue}
          {!pending ? <ArrowRight /> : null}
        </Button>
      </div>
    </div>
  )
}
