import Link from "next/link";
import type { Advice, AssessmentStatus, ConditionStatus, ProcedureLifecycle } from "@/db/schema";
import { ADVICE_LABEL } from "@/lib/domain/assessment-engine";
import { STATUS_LABEL } from "@/lib/domain/publication";
import { LIFECYCLE_LABEL } from "@/lib/domain/lifecycle";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "navy";
const TONE: Record<Tone, string> = {
  ok: "bg-ok-50 text-ok-700 border-ok-700/20",
  warn: "bg-warn-50 text-warn-700 border-warn-700/20",
  bad: "bg-bad-50 text-bad-700 border-bad-700/20",
  info: "bg-info-50 text-info-700 border-info-700/20",
  neutral: "bg-neutral-50 text-neutral-700 border-neutral-700/20",
  navy: "bg-navy-900 text-white border-navy-900",
};
const ICON: Record<Tone, string> = { ok: "✓", warn: "!", bad: "✕", info: "i", neutral: "•", navy: "" };

export function Badge({ tone = "neutral", children, icon = true, title }: { tone?: Tone; children: React.ReactNode; icon?: boolean; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap", TONE[tone])}>
      {icon && ICON[tone] && <span aria-hidden>{ICON[tone]}</span>}
      {children}
    </span>
  );
}

export function AdviceBadge({ advice }: { advice: Advice }) {
  const tone: Tone = advice === "investigate" ? "ok" : advice === "check_missing" ? "warn" : "bad";
  return <Badge tone={tone}>{ADVICE_LABEL[advice]}</Badge>;
}

export function AssessmentStatusBadge({ status }: { status: AssessmentStatus }) {
  const tone: Tone = status === "published" ? "ok" : status === "approved" ? "info" : status === "to_review" ? "warn" : status === "rejected" ? "bad" : "neutral";
  return <Badge tone={tone}>{STATUS_LABEL[status]}</Badge>;
}

export const CONDITION_LABEL: Record<ConditionStatus, string> = {
  met: "Voldaan",
  not_met: "Niet voldaan",
  unknown: "Onbekend",
  not_applicable: "Niet van toepassing",
};
export function ConditionBadge({ status }: { status: ConditionStatus }) {
  const tone: Tone = status === "met" ? "ok" : status === "not_met" ? "bad" : status === "unknown" ? "warn" : "neutral";
  return <Badge tone={tone}>{CONDITION_LABEL[status]}</Badge>;
}

export function LifecycleBadge({ lifecycle }: { lifecycle: ProcedureLifecycle }) {
  const tone: Tone = lifecycle === "open" ? "info" : lifecycle === "unknown" ? "warn" : "neutral";
  return <Badge tone={tone}>{LIFECYCLE_LABEL[lifecycle]}</Badge>;
}

export function VerificationBadge({ status, method }: { status: string; method?: string }) {
  const label =
    status === "verified" ? "Gecontroleerd" : status === "rejected" ? "Afgewezen" : status === "evidence_not_found" ? "Bewijs niet gevonden" : "Niet gecontroleerd";
  const tone: Tone = status === "verified" ? "ok" : status === "unverified" ? "warn" : "bad";
  const m = method === "structured_field" ? "bronveld" : method === "ai" ? "AI-extractie" : method === "manual" ? "handmatig" : null;
  return (
    <span className="inline-flex items-center gap-1">
      <Badge tone={tone}>{label}</Badge>
      {m && <span className="text-xs text-muted">· {m}</span>}
    </span>
  );
}

export function Card({ children, className, title, actions }: { children: React.ReactNode; className?: string; title?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className={cx("rounded-lg border border-line bg-white", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          {title && <h2 className="text-[15px] font-semibold text-navy-900">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const BTN = {
  primary: "bg-navy-900 text-white hover:bg-navy-800 border-navy-900",
  secondary: "bg-white text-navy-900 hover:bg-navy-50 border-line",
  danger: "bg-white text-bad-700 hover:bg-bad-50 border-bad-700/30",
  ghost: "bg-transparent text-navy-700 hover:bg-navy-50 border-transparent",
};
export function btn(kind: keyof typeof BTN = "primary", size: "sm" | "md" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
    size === "sm" ? "px-2.5 py-1 text-[13px]" : "px-3.5 py-2 text-sm",
    BTN[kind],
  );
}
export function ButtonLink({ href, children, kind = "primary", size = "md" }: { href: string; children: React.ReactNode; kind?: keyof typeof BTN; size?: "sm" | "md" }) {
  return (
    <Link href={href} className={btn(kind, size)}>
      {children}
    </Link>
  );
}

export function Field({ label, hint, children, error }: { label: string; hint?: React.ReactNode; children: React.ReactNode; error?: string | null }) {
  return (
    <div className="space-y-1">
      <label className="block">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs font-medium text-bad-700">{error}</p>}
    </div>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: Tone; title?: string; children: React.ReactNode }) {
  return (
    <div className={cx("rounded-md border px-3 py-2.5 text-sm", TONE[tone])} role={tone === "bad" ? "alert" : "status"}>
      {title && <div className="font-semibold">{title}</div>}
      <div className={title ? "mt-0.5" : ""}>{children}</div>
    </div>
  );
}

export function KeyValue({ items }: { items: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[180px_1fr]">
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="text-ink">{v ?? <Unknown />}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Unknown({ children = "onbekend" }: { children?: React.ReactNode }) {
  return <span className="italic text-warn-700">{children}</span>;
}

/** Visuele scheiding: feiten (uit bron) vs. interpretatie (onze lezing). */
export function FactLabel() {
  return <span className="rounded bg-navy-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-navy-800">Feit uit bron</span>;
}
export function InterpretationLabel() {
  return <span className="rounded bg-warn-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-warn-700 border border-warn-700/20">Onze interpretatie</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed border-line bg-canvas px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

export function Flash({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ok = typeof searchParams.ok === "string" ? searchParams.ok : null;
  const err = typeof searchParams.fout === "string" ? searchParams.fout : null;
  if (!ok && !err) return null;
  return <div className="mb-4">{err ? <Notice tone="bad">{err}</Notice> : <Notice tone="ok">{ok}</Notice>}</div>;
}
