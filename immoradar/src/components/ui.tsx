import Link from "next/link";
import type { ReactNode } from "react";
import { humanize } from "@/lib/format";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function scoreTone(score: number): "hot" | "warm" | "cool" {
  if (score >= 85) return "hot";
  if (score >= 65) return "warm";
  return "cool";
}

export function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const tone = scoreTone(score);
  const color = tone === "hot" ? "bg-hot-600 text-white" : tone === "warm" ? "bg-warm-600 text-white" : "bg-ink-600 text-white";
  const dims = size === "lg" ? "h-16 w-16 text-2xl" : size === "sm" ? "h-8 w-8 text-xs" : "h-11 w-11 text-base";
  return (
    <div className={`flex ${dims} shrink-0 items-center justify-center rounded-md font-bold tabular-nums ${color}`} title={`Opportunity score ${score}/100`}>
      {score}
    </div>
  );
}

export function ScoreBar({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-ink-700">{label}</span>
        <span className="tabular-nums text-ink-500">{value}/100</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-ink-100">
        <div className="h-full rounded bg-brand-600" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-brand-100 text-brand-700",
  ASSIGNED: "bg-brand-100 text-brand-700",
  TO_CONTACT: "bg-warm-100 text-warm-600",
  CONTACTED: "bg-warm-100 text-warm-600",
  INTERESTED: "bg-good-100 text-good-600",
  VALUATION_BOOKED: "bg-good-100 text-good-600",
  MANDATE_PROPOSED: "bg-good-100 text-good-600",
  MANDATE_WON: "bg-good-600 text-white",
  LOST: "bg-ink-200 text-ink-600",
  DISMISSED: "bg-ink-200 text-ink-600",
  PRIVATE: "bg-good-100 text-good-600",
  PROFESSIONAL: "bg-ink-100 text-ink-600",
  UNKNOWN: "bg-ink-100 text-ink-500",
  ACTIVE: "bg-good-100 text-good-600",
  MISSING: "bg-warm-100 text-warm-600",
  REMOVED: "bg-ink-200 text-ink-600",
  HEALTHY: "bg-good-100 text-good-600",
  DEGRADED: "bg-warm-100 text-warm-600",
  DOWN: "bg-hot-100 text-hot-600",
  DISABLED: "bg-ink-100 text-ink-500",
  SENT: "bg-good-100 text-good-600",
  FAILED: "bg-hot-100 text-hot-600",
  SKIPPED: "bg-ink-100 text-ink-500",
  PENDING: "bg-warm-100 text-warm-600",
  SUCCESS: "bg-good-100 text-good-600",
  COMPLETED: "bg-good-100 text-good-600",
  CREATED: "bg-good-100 text-good-600",
  UPDATED: "bg-brand-100 text-brand-700",
  DUPLICATE: "bg-ink-100 text-ink-500",
  CONFLICT: "bg-warm-100 text-warm-600",
  INVALID: "bg-hot-100 text-hot-600",
};

export function Pill({ value, label }: { value: string; label?: string }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[value] ?? "bg-ink-100 text-ink-600"}`}>{label ?? humanize(value)}</span>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {hint ? <p className="mt-1 text-sm text-ink-500">{hint}</p> : null}
    </div>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: string; href?: string }) {
  const body = (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      <header className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-ink-800">{title}</h2>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Reasons({ reasons }: { reasons: string[] }) {
  if (!reasons.length) return null;
  return (
    <ul className="space-y-0.5 text-sm text-ink-700">
      {reasons.map((r, i) => (
        <li key={i} className="flex gap-1.5">
          <span className="text-good-600">+</span>
          <span>{r}</span>
        </li>
      ))}
    </ul>
  );
}

export function Notice({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  if (searchParams.error) return <p className="mb-4 rounded-md bg-hot-100 px-3 py-2 text-sm text-hot-600">{searchParams.error}</p>;
  if (searchParams.ok) return <p className="mb-4 rounded-md bg-good-100 px-3 py-2 text-sm text-good-600">{searchParams.ok}</p>;
  return null;
}
