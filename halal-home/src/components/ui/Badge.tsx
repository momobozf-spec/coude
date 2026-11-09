import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type BadgeTone = 'neutral' | 'accent' | 'warning' | 'danger' | 'muted'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--color-sand-200)] text-[var(--color-ink-800)]',
  accent: 'bg-[var(--color-olive-100)] text-[var(--color-olive-700)]',
  warning: 'bg-[var(--color-amber-soft)]/40 text-[var(--color-amber-deep)]',
  danger: 'bg-[var(--color-rust-soft)]/40 text-[var(--color-rust-deep)]',
  muted: 'bg-transparent text-[var(--muted)] border',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
