import { cn } from '@/lib/utils'

/**
 * Voortgangsbalk.
 *
 * `role="progressbar"` met de aria-waarden staat er niet voor de vorm: de
 * voortgang van het traject is de kernboodschap van het dashboard, en die moet
 * ook voorgelezen kunnen worden.
 */
export function ProgressBar({
  value,
  label,
  className,
}: {
  value: number
  label?: string
  className?: string
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="text-[var(--muted)]">{label}</span>
          <span className="font-semibold tabular-nums">{clamped}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Voortgang'}
        className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-sand-200)]"
      >
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
