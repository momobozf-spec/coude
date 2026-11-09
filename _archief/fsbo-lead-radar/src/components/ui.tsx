/**
 * De handvol bouwstenen waaruit het dashboard bestaat.
 *
 * Bewust klein gehouden: dit is een bedieningspaneel, geen product. Elke
 * component hier bestaat omdat hij op minstens twee schermen terugkomt.
 */
import clsx from 'clsx'
import Link from 'next/link'

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={clsx(
        'rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)]',
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-line)] px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: number | string
  hint?: string
  tone?: 'default' | 'good' | 'warn' | 'bad'
}) {
  const toneClass = {
    default: 'text-[var(--color-ink)]',
    good: 'text-[var(--color-private)]',
    warn: 'text-[var(--color-professional)]',
    bad: 'text-[var(--color-danger)]',
  }[tone]

  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3">
      <p className="text-xs text-[var(--color-ink-soft)]">{label}</p>
      <p className={clsx('tabular mt-1 text-2xl font-semibold', toneClass)}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{hint}</p>}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'private' | 'professional' | 'unknown' | 'good' | 'bad' | 'warn'
  title?: string
}) {
  const toneClass = {
    neutral: 'border-[var(--color-line)] text-[var(--color-ink-soft)]',
    private: 'border-emerald-500/40 bg-emerald-500/10 text-[var(--color-private)]',
    professional: 'border-orange-500/40 bg-orange-500/10 text-[var(--color-professional)]',
    unknown: 'border-slate-500/40 bg-slate-500/10 text-[var(--color-unknown)]',
    good: 'border-emerald-500/40 bg-emerald-500/10 text-[var(--color-private)]',
    warn: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    bad: 'border-red-500/40 bg-red-500/10 text-[var(--color-danger)]',
  }[tone]

  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap',
        toneClass,
      )}
    >
      {children}
    </span>
  )
}

/** De leadscore als getal én als staafje: het patroon leest sneller dan cijfers. */
export function ScoreBar({ score }: { score: number }) {
  const tone = score >= 80 ? 'bg-emerald-400' : score >= 55 ? 'bg-amber-400' : 'bg-slate-500'

  return (
    <div className="flex items-center gap-2">
      <span className="tabular w-7 text-right text-xs font-semibold">{score}</span>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--color-panel-soft)]">
        <span
          className={clsx('block h-full rounded-full', tone)}
          style={{ width: `${Math.max(2, score)}%` }}
        />
      </span>
    </div>
  )
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-xs">{children}</table>
    </div>
  )
}

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={clsx(
        'border-b border-[var(--color-line)] px-3 py-2 font-medium text-[var(--color-ink-soft)]',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className,
  title,
}: {
  children: React.ReactNode
  className?: string
  /** Tooltip — draagt in tabellen de details die niet in de kolom passen. */
  title?: string
}) {
  return (
    <td
      title={title}
      className={clsx('border-b border-[var(--color-line)]/60 px-3 py-2 align-top', className)}
    >
      {children}
    </td>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-8 text-center text-xs text-[var(--color-ink-soft)]">{children}</p>
}

export function Button({
  children,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const variantClass = {
    primary: 'bg-[var(--color-accent)] text-white hover:bg-blue-500',
    ghost:
      'border border-[var(--color-line)] bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-panel-soft)]',
    danger: 'border border-red-500/40 bg-red-500/10 text-[var(--color-danger)] hover:bg-red-500/20',
  }[variant]

  return (
    <button
      {...props}
      className={clsx(
        'cursor-pointer rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variantClass,
        props.className,
      )}
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[var(--color-ink-soft)]">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded border border-[var(--color-line)] bg-[var(--color-panel-soft)] px-2 py-1.5 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]'

export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      // noreferrer hoort erbij: zonder dat lekt de URL van dit paneel naar de bron.
      rel="noopener noreferrer"
      className="text-[var(--color-accent)] hover:underline"
    >
      {children}
    </a>
  )
}

export function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'rounded px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-[var(--color-panel-soft)] text-[var(--color-ink)]'
          : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]',
      )}
    >
      {children}
    </Link>
  )
}
