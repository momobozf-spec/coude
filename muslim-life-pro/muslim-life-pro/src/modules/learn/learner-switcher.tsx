'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { setActiveLearnerAction, skipPlacementAction } from '@/modules/learn/actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface LearnerChip {
  id: string
  label: string
  detail: string
}

/** Who is learning on this device: the holder and any children. */
export function LearnerSwitcher({
  learners,
  activeId,
  canAddChild,
  labels,
}: {
  learners: LearnerChip[]
  activeId: string
  canAddChild: boolean
  labels: { whoLearns: string; addChild: string }
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function select(id: string) {
    if (id === activeId) return
    startTransition(async () => {
      const response = await setActiveLearnerAction({ learnerId: id })
      if (response.ok) router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{labels.whoLearns}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={labels.whoLearns} aria-busy={pending}>
        {learners.map((learner) => (
          <button
            key={learner.id}
            type="button"
            role="radio"
            aria-checked={learner.id === activeId}
            disabled={pending}
            className={cn(
              'flex flex-col items-start rounded-xl border px-3.5 py-2 text-start transition-colors',
              learner.id === activeId
                ? 'border-primary bg-primary-subtle'
                : 'border-border bg-surface hover:border-border-strong hover:bg-muted',
            )}
            onClick={() => select(learner.id)}
          >
            <span className="text-sm font-medium">{learner.label}</span>
            <span className="text-xs text-muted-foreground">{learner.detail}</span>
          </button>
        ))}
        {canAddChild ? (
          <Link
            href="/app/learn/profiles/new"
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            <Plus className="size-4" aria-hidden />
            {labels.addChild}
          </Link>
        ) : null}
      </div>
    </div>
  )
}

/** Start without the level test. */
export function SkipPlacementButton({ learnerId, label }: { learnerId: string; label: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="secondary"
      loading={pending}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const response = await skipPlacementAction({ learnerId })
          if (response.ok) router.refresh()
        })
      }
    >
      {label}
    </Button>
  )
}
