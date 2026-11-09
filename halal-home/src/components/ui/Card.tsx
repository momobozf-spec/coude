import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * De basiskaart. Vrijwel elk scherm is een verticale stapel van deze kaarten —
 * dat is de hele lay-outstrategie, en de reden dat de app op een telefoon
 * hetzelfde leest als op een laptop.
 */
export function Card({
  children,
  className,
  as: Component = 'section',
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'article' | 'div'
}) {
  return (
    <Component
      className={cn(
        'rounded-2xl border bg-[var(--surface)] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        className,
      )}
    >
      {children}
    </Component>
  )
}

export function CardHeader({
  title,
  action,
  description,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/** Lege staat. Altijd met een uitweg — nooit alleen "geen resultaten". */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="py-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-[var(--muted)]">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
