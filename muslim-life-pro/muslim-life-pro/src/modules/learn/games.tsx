'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, Timer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { shuffledIndices } from '@/modules/learn/shuffle'
import type { AnswerValue } from '@/lib/learn/grading'
import type { LocalizedExercise } from '@/server/modules/learn/learn.service'
import { cn } from '@/lib/utils'

/**
 * The exercise and game components of the lesson player.
 *
 * Each one reports the member's raw answer through `onChange`; deciding
 * whether it is right is the job of {@link isAnswerCorrect} for instant
 * feedback, and of the server (src/lib/learn/grading.ts) for anything stored.
 */

/** Translated strings the games need. Templates keep `{name}` placeholders. */
export interface GameLabels {
  true: string
  false: string
  orderHint: string
  reset: string
  matchHint: string
  memoryHint: string
  memoryDone: string
  wordHint: string
  clue: string
  quickfireIntro: string
  quickfireStart: string
  timeLeft: string
  timeUp: string
  quickfireScore: string
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Answer state
// ─────────────────────────────────────────────────────────────────────────────

/** Whether enough has been answered to check. `done` is set when a timer ran out. */
export function isAnswered(exercise: LocalizedExercise, answer: AnswerValue | undefined, done: boolean): boolean {
  if (exercise.type === 'quickfire') return done || (Array.isArray(answer) && answer.length === exercise.items.length)
  if (answer === undefined) return false
  switch (exercise.type) {
    case 'order':
      return Array.isArray(answer) && answer.length === exercise.items.length
    case 'match':
      return Array.isArray(answer) && answer.length === exercise.pairs.length
    case 'wordbuild':
      return Array.isArray(answer) && answer.length === exercise.word.length
    default:
      return true
  }
}

function identity(answer: AnswerValue | undefined, length: number): boolean {
  return Array.isArray(answer) && answer.length === length && answer.every((value, index) => value === index)
}

/** Mirrors the server's grading, for immediate feedback only. */
export function isAnswerCorrect(exercise: LocalizedExercise, answer: AnswerValue | undefined): boolean {
  switch (exercise.type) {
    case 'choice':
    case 'truefalse':
      return answer === exercise.answer
    case 'order':
      return identity(answer, exercise.items.length)
    case 'match':
      return identity(answer, exercise.pairs.length)
    case 'wordbuild':
      return (
        Array.isArray(answer) &&
        answer.length === exercise.word.length &&
        new Set(answer).size === answer.length &&
        answer.map((tile) => (typeof tile === 'number' ? exercise.word[tile] : '')).join('') === exercise.word
      )
    case 'quickfire': {
      if (!Array.isArray(answer)) return false
      const right = exercise.items.reduce((sum, item, index) => sum + (answer[index] === item.answer ? 1 : 0), 0)
      return right >= Math.ceil(exercise.items.length * 0.8)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared look
// ─────────────────────────────────────────────────────────────────────────────

function optionClass(selected: boolean, checked: boolean, isRight: boolean, big: boolean) {
  return cn(
    'w-full rounded-lg border px-4 text-start transition-colors',
    big ? 'py-4 text-base' : 'py-3 text-sm',
    !checked && (selected ? 'border-primary bg-primary-subtle' : 'border-border hover:bg-muted'),
    checked && isRight && 'border-success bg-success-subtle',
    checked && selected && !isRight && 'border-warning bg-warning-subtle',
    checked && !selected && !isRight && 'border-border opacity-60',
  )
}

interface GameProps<E extends LocalizedExercise['type']> {
  exercise: Extract<LocalizedExercise, { type: E }>
  seed: string
  answer: AnswerValue | undefined
  checked: boolean
  labels: GameLabels
  /** Larger targets and simpler interactions for children. */
  kids: boolean
  onChange: (value: AnswerValue | undefined) => void
  onDone?: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Choice and true/false
// ─────────────────────────────────────────────────────────────────────────────

export function ChoiceGame({ exercise, seed, answer, checked, kids, onChange }: GameProps<'choice'>) {
  const order = useMemo(() => shuffledIndices(exercise.options.length, seed), [exercise.options.length, seed])
  const value = typeof answer === 'number' ? answer : undefined

  return (
    <div className="space-y-2" role="radiogroup" aria-label={exercise.prompt}>
      {order.map((optionIndex) => (
        <button
          key={optionIndex}
          type="button"
          role="radio"
          aria-checked={value === optionIndex}
          disabled={checked}
          className={optionClass(value === optionIndex, checked, optionIndex === exercise.answer, kids)}
          onClick={() => onChange(optionIndex)}
        >
          {exercise.options[optionIndex]}
        </button>
      ))}
    </div>
  )
}

export function TrueFalseGame({ exercise, answer, checked, labels, kids, onChange }: GameProps<'truefalse'>) {
  const value = typeof answer === 'boolean' ? answer : undefined
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={exercise.prompt}>
      {[true, false].map((option) => (
        <button
          key={String(option)}
          type="button"
          role="radio"
          aria-checked={value === option}
          disabled={checked}
          className={cn(optionClass(value === option, checked, option === exercise.answer, kids), 'text-center')}
          onClick={() => onChange(option)}
        >
          {option ? labels.true : labels.false}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Order
// ─────────────────────────────────────────────────────────────────────────────

export function OrderGame({ exercise, seed, answer, checked, labels, kids, onChange }: GameProps<'order'>) {
  const order = useMemo(() => shuffledIndices(exercise.items.length, seed), [exercise.items.length, seed])
  const value = Array.isArray(answer) ? (answer as number[]) : []
  const remaining = order.filter((itemIndex) => !value.includes(itemIndex))

  return (
    <div className="space-y-4">
      {value.length > 0 ? (
        <ol className="space-y-2">
          {value.map((itemIndex, position) => {
            const right = itemIndex === position
            return (
              <li
                key={itemIndex}
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-4',
                  kids ? 'py-4 text-base' : 'py-3 text-sm',
                  !checked && 'border-primary/40 bg-primary-subtle',
                  checked && right && 'border-success bg-success-subtle',
                  checked && !right && 'border-warning bg-warning-subtle',
                )}
              >
                <span className="font-medium tabular-nums">{position + 1}.</span>
                <span>{exercise.items[itemIndex]}</span>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="text-xs text-muted-foreground">{labels.orderHint}</p>
      )}

      {!checked && remaining.length > 0 ? (
        <div className="space-y-2">
          {remaining.map((itemIndex) => (
            <button
              key={itemIndex}
              type="button"
              className={cn(
                'w-full rounded-lg border border-dashed border-border px-4 text-start hover:bg-muted',
                kids ? 'py-4 text-base' : 'py-3 text-sm',
              )}
              onClick={() => onChange([...value, itemIndex])}
            >
              {exercise.items[itemIndex]}
            </button>
          ))}
        </div>
      ) : null}

      {!checked && value.length > 0 ? (
        <Button variant="ghost" size="sm" onClick={() => onChange(undefined)}>
          <RotateCcw />
          {labels.reset}
        </Button>
      ) : null}

      {checked && !value.every((itemIndex, position) => itemIndex === position) ? (
        <ol className="space-y-1 text-xs text-muted-foreground">
          {exercise.items.map((item, position) => (
            <li key={position}>
              {position + 1}. {item}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Match: tap-to-pair for teens and adults, memory cards for children
// ─────────────────────────────────────────────────────────────────────────────

export function MatchGame(props: GameProps<'match'>) {
  return props.kids ? <MemoryCards {...props} /> : <PairColumns {...props} />
}

function PairColumns({ exercise, seed, answer, checked, labels, onChange }: GameProps<'match'>) {
  const rightOrder = useMemo(() => shuffledIndices(exercise.pairs.length, seed), [exercise.pairs.length, seed])
  // pairing[left] = right index chosen for that left item.
  const [pairing, setPairing] = useState<(number | null)[]>(() =>
    Array.isArray(answer) ? (answer as number[]) : exercise.pairs.map(() => null),
  )
  const [activeLeft, setActiveLeft] = useState<number | null>(() => (Array.isArray(answer) ? null : 0))

  function choose(right: number) {
    if (checked || activeLeft === null) return
    const next = pairing.map((value) => (value === right ? null : value))
    next[activeLeft] = right
    setPairing(next)
    const open = next.findIndex((value) => value === null)
    setActiveLeft(open === -1 ? null : open)
    onChange(next.every((value) => value !== null) ? (next as number[]) : undefined)
  }

  function reset() {
    setPairing(exercise.pairs.map(() => null))
    setActiveLeft(0)
    onChange(undefined)
  }

  const usedRights = new Set(pairing.filter((value): value is number => value !== null))

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{labels.matchHint}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          {exercise.pairs.map((pair, left) => {
            const chosen = pairing[left]
            const right = checked && chosen === left
            return (
              <button
                key={left}
                type="button"
                disabled={checked}
                aria-pressed={activeLeft === left}
                className={cn(
                  'flex min-h-14 w-full flex-col items-start justify-center rounded-lg border px-3 py-2 text-start text-sm',
                  !checked && activeLeft === left && 'border-primary bg-primary-subtle',
                  !checked && activeLeft !== left && 'border-border hover:bg-muted',
                  checked && right && 'border-success bg-success-subtle',
                  checked && !right && 'border-warning bg-warning-subtle',
                )}
                onClick={() => setActiveLeft(left)}
              >
                <span className="font-medium">{pair.left}</span>
                {chosen !== null && chosen !== undefined ? (
                  <span className="text-xs text-muted-foreground">→ {exercise.pairs[chosen]?.right}</span>
                ) : null}
              </button>
            )
          })}
        </div>
        <div className="space-y-2">
          {rightOrder.map((right) => (
            <button
              key={right}
              type="button"
              disabled={checked || activeLeft === null}
              className={cn(
                'flex min-h-14 w-full items-center rounded-lg border border-dashed px-3 py-2 text-start text-sm',
                usedRights.has(right) ? 'border-border text-muted-foreground' : 'border-border-strong',
                !checked && activeLeft !== null && 'hover:bg-muted',
              )}
              onClick={() => choose(right)}
            >
              {exercise.pairs[right]?.right}
            </button>
          ))}
        </div>
      </div>
      {!checked && usedRights.size > 0 ? (
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw />
          {labels.reset}
        </Button>
      ) : null}
      {checked ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {exercise.pairs.map((pair, index) => (
            <li key={index}>
              {pair.left} → {pair.right}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

interface Card {
  pair: number
  side: 'left' | 'right'
  text: string
}

function MemoryCards({ exercise, seed, answer, labels, onChange }: GameProps<'match'>) {
  const cards = useMemo<Card[]>(() => {
    const all: Card[] = exercise.pairs.flatMap((pair, index) => [
      { pair: index, side: 'left' as const, text: pair.left },
      { pair: index, side: 'right' as const, text: pair.right },
    ])
    return shuffledIndices(all.length, seed).map((index) => all[index]!)
  }, [exercise.pairs, seed])

  const alreadyDone = Array.isArray(answer)
  const [found, setFound] = useState<Set<number>>(() => new Set(alreadyDone ? exercise.pairs.map((_, i) => i) : []))
  const [open, setOpen] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timeout.current) clearTimeout(timeout.current)
  }, [])

  function flip(index: number) {
    if (open.length === 2 || open.includes(index) || found.has(cards[index]!.pair)) return
    const next = [...open, index]
    setOpen(next)
    if (next.length < 2) return

    setMoves((count) => count + 1)
    const [a, b] = next.map((cardIndex) => cards[cardIndex]!)
    if (a!.pair === b!.pair && a!.side !== b!.side) {
      const done = new Set(found).add(a!.pair)
      setFound(done)
      setOpen([])
      // Memory always ends solved: finishing it is the answer.
      if (done.size === exercise.pairs.length) onChange(exercise.pairs.map((_, i) => i))
    } else {
      timeout.current = setTimeout(() => setOpen([]), 900)
    }
  }

  const complete = found.size === exercise.pairs.length

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {complete ? fill(labels.memoryDone, { moves }) : labels.memoryHint}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card, index) => {
          const shown = open.includes(index) || found.has(card.pair)
          return (
            <button
              key={index}
              type="button"
              aria-label={shown ? card.text : '?'}
              className={cn(
                'flex aspect-[4/3] items-center justify-center rounded-xl border-2 p-2 text-center text-base font-medium transition-colors',
                found.has(card.pair) && 'border-success bg-success-subtle',
                !found.has(card.pair) && shown && 'border-primary bg-primary-subtle',
                !shown && 'border-border bg-primary text-primary-foreground hover:brightness-110',
              )}
              onClick={() => flip(index)}
            >
              {shown ? card.text : '?'}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Word builder
// ─────────────────────────────────────────────────────────────────────────────

export function WordBuildGame({ exercise, seed, answer, checked, labels, kids, onChange }: GameProps<'wordbuild'>) {
  const tiles = useMemo(() => {
    const order = shuffledIndices(exercise.word.length, seed)
    // With repeated letters a shuffle can still read as the word: rotate it.
    const reads = (indices: number[]) => indices.map((tile) => exercise.word[tile]).join('') === exercise.word
    return reads(order) ? [...order.slice(1), order[0]!] : order
  }, [exercise.word, seed])
  const value = Array.isArray(answer) ? (answer as number[]) : []
  const built = value.map((tile) => exercise.word[tile]).join('')
  const right = checked && built === exercise.word

  return (
    <div className="space-y-4">
      <p className="text-sm">
        <span className="text-muted-foreground">{labels.clue}: </span>
        {exercise.meaning}
      </p>

      <div className="flex flex-wrap justify-center gap-2" aria-live="polite">
        {exercise.word.split('').map((_, position) => (
          <span
            key={position}
            className={cn(
              'flex items-center justify-center rounded-lg border-2 font-display font-semibold',
              kids ? 'size-14 text-2xl' : 'size-11 text-xl',
              !checked && 'border-border',
              checked && right && 'border-success bg-success-subtle',
              checked && !right && 'border-warning bg-warning-subtle',
            )}
          >
            {built[position] ?? ''}
          </span>
        ))}
      </div>

      {!checked ? (
        <>
          <p className="text-center text-xs text-muted-foreground">{labels.wordHint}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {tiles.map((tile) => {
              const used = value.includes(tile)
              return (
                <button
                  key={tile}
                  type="button"
                  disabled={used}
                  className={cn(
                    'flex items-center justify-center rounded-lg border font-display font-semibold transition-opacity',
                    kids ? 'size-14 text-2xl' : 'size-11 text-xl',
                    used ? 'border-border opacity-30' : 'border-border-strong bg-surface hover:bg-muted',
                  )}
                  onClick={() => onChange([...value, tile])}
                >
                  {exercise.word[tile]}
                </button>
              )
            })}
          </div>
          {value.length > 0 ? (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={() => onChange(undefined)}>
                <RotateCcw />
                {labels.reset}
              </Button>
            </div>
          ) : null}
        </>
      ) : !right ? (
        <p className="text-center font-display text-xl font-semibold tracking-widest">{exercise.word}</p>
      ) : null}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick-fire round
// ─────────────────────────────────────────────────────────────────────────────

export function QuickfireGame({ exercise, answer, checked, labels, kids, onChange, onDone }: GameProps<'quickfire'>) {
  const given = Array.isArray(answer) ? (answer as boolean[]) : []
  const [started, setStarted] = useState(given.length > 0)
  const [left, setLeft] = useState(exercise.seconds)
  const finished = checked || given.length === exercise.items.length || left === 0

  useEffect(() => {
    if (!started || finished) return
    const tick = setInterval(() => setLeft((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => clearInterval(tick)
  }, [started, finished])

  // Report the timeout once, however often the parent re-renders.
  const reported = useRef(false)
  useEffect(() => {
    if (started && left === 0 && !reported.current) {
      reported.current = true
      onDone?.()
    }
  }, [started, left, onDone])

  const current = exercise.items[given.length]
  const right = exercise.items.reduce((sum, item, index) => sum + (given[index] === item.answer ? 1 : 0), 0)

  if (!started) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          {fill(labels.quickfireIntro, { count: exercise.items.length, seconds: exercise.seconds })}
        </p>
        <Button size={kids ? 'xl' : 'lg'} onClick={() => setStarted(true)}>
          <Timer />
          {labels.quickfireStart}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">
          {Math.min(given.length + 1, exercise.items.length)} / {exercise.items.length}
        </span>
        <span className={cn('flex items-center gap-1 tabular-nums', left <= 5 && !finished && 'text-warning')}>
          <Timer className="size-3.5" aria-hidden />
          {left === 0 && !checked ? labels.timeUp : fill(labels.timeLeft, { seconds: left })}
        </span>
      </div>

      {!finished && current ? (
        <div className="space-y-3">
          <p className={cn('rounded-lg bg-muted px-4 py-5 text-center font-medium', kids ? 'text-lg' : 'text-base')}>
            {current.statement}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[true, false].map((option) => (
              <Button
                key={String(option)}
                variant="secondary"
                size={kids ? 'xl' : 'lg'}
                onClick={() => onChange([...given, option])}
              >
                {option ? labels.true : labels.false}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {fill(labels.quickfireScore, { right, total: exercise.items.length })}
          </p>
          {checked ? (
            <ul className="space-y-1">
              {exercise.items.map((item, index) => {
                const ok = given[index] === item.answer
                return (
                  <li
                    key={index}
                    className={cn(
                      'rounded-md px-3 py-2 text-xs',
                      ok ? 'bg-success-subtle' : 'bg-warning-subtle',
                    )}
                  >
                    {item.statement} — <strong>{item.answer ? labels.true : labels.false}</strong>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

/** Render whichever game an exercise is. */
export function ExerciseGame(props: {
  exercise: LocalizedExercise
  seed: string
  answer: AnswerValue | undefined
  checked: boolean
  labels: GameLabels
  kids: boolean
  onChange: (value: AnswerValue | undefined) => void
  onDone: () => void
}) {
  const { exercise, ...rest } = props
  switch (exercise.type) {
    case 'choice':
      return <ChoiceGame exercise={exercise} {...rest} />
    case 'truefalse':
      return <TrueFalseGame exercise={exercise} {...rest} />
    case 'order':
      return <OrderGame exercise={exercise} {...rest} />
    case 'match':
      return <MatchGame exercise={exercise} {...rest} />
    case 'wordbuild':
      return <WordBuildGame exercise={exercise} {...rest} />
    case 'quickfire':
      return <QuickfireGame exercise={exercise} {...rest} />
  }
}
