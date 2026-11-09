import type { LucideIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}

/**
 * The state shown for modules that are designed and scheduled but not yet built.
 *
 * Deliberately explicit about *what* is coming and *when* — a vague "coming soon"
 * reads as abandonment, a specific roadmap reads as momentum.
 */
export function ModuleInBuild({
  icon: Icon,
  phase,
  title,
  description,
  features,
}: {
  icon: LucideIcon
  phase: string
  title: string
  description: string
  features: string[]
}) {
  return (
    <Card className="p-8 text-center sm:p-12">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-subtle">
        <Icon className="size-5.5 text-primary-subtle-foreground" />
      </span>

      <Badge variant="primary" className="mt-5">
        {phase}
      </Badge>

      <h2 className="mt-4 text-balance font-display text-xl font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      <p className="mx-auto mt-2.5 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      <ul className="mx-auto mt-7 grid max-w-md gap-2 text-start sm:grid-cols-2">
        {features.map((feature) => (
          <li
            key={feature}
            className="rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs text-muted-foreground"
          >
            {feature}
          </li>
        ))}
      </ul>
    </Card>
  )
}
