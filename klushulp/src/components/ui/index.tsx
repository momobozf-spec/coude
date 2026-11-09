import Link from "next/link";
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, LabelHTMLAttributes } from "react";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
export { cx };

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong disabled:bg-line-strong",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-brand-soft hover:border-brand",
  ghost: "bg-transparent text-brand hover:bg-brand-soft",
  danger: "bg-surface text-danger border border-danger/40 hover:bg-danger-soft",
};
const base = "inline-flex items-center justify-center gap-2 rounded-xl px-5 min-h-12 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 select-none";

export function Button({ variant = "primary", className, full, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; full?: boolean }) {
  return <button className={cx(base, variants[variant], full && "w-full", className)} {...props} />;
}

export function LinkButton({ href, variant = "primary", className, children, full }: { href: string; variant?: Variant; className?: string; children: ReactNode; full?: boolean }) {
  return (
    <Link href={href} className={cx(base, variants[variant], full && "w-full", className)}>
      {children}
    </Link>
  );
}

export function Card({ children, className, as: As = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" | "li" }) {
  return <As className={cx("bg-surface rounded-card border border-line shadow-card p-5 sm:p-6", className)}>{children}</As>;
}

export function Label({ children, className, hint, ...props }: LabelHTMLAttributes<HTMLLabelElement> & { hint?: string }) {
  return (
    <label className={cx("block text-sm font-semibold text-ink mb-1.5", className)} {...props}>
      {children}
      {hint && <span className="ml-1 font-normal text-muted">({hint})</span>}
    </label>
  );
}

const fieldBase = "w-full rounded-xl border border-line-strong bg-surface px-4 min-h-12 text-base text-ink placeholder:text-muted/70 focus:border-brand aria-[invalid=true]:border-danger";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(fieldBase, className)} {...props} />;
}
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select className={cx(fieldBase, "appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldBase, "py-3 min-h-32 leading-relaxed", className)} {...props} />;
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1.5 text-sm text-danger">
      {children}
    </p>
  );
}
export function Help({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-sm text-muted">{children}</p>;
}

type Tone = "neutral" | "brand" | "ok" | "warn" | "danger" | "accent";
const tones: Record<Tone, string> = {
  neutral: "bg-paper text-muted border-line",
  brand: "bg-brand-soft text-brand-strong border-brand/20",
  ok: "bg-ok-soft text-ok border-ok/20",
  warn: "bg-warn-soft text-warn border-warn/20",
  danger: "bg-danger-soft text-danger border-danger/20",
  accent: "bg-accent-soft text-accent border-accent/20",
};
export function Badge({ children, tone = "neutral", title, className }: { children: ReactNode; tone?: Tone; title?: string; className?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Alert({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-xl border px-4 py-3 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">{children}</h1>
      {sub && <p className="mt-1.5 text-muted">{sub}</p>}
    </header>
  );
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx("text-lg font-bold text-ink", className)}>{children}</h2>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-card border border-dashed border-line-strong bg-surface/60 px-5 py-8 text-center text-muted">{children}</div>;
}

export function Stars({ value, count, label }: { value: number | null; count: number; label: string }) {
  if (!value) return <span className="text-sm text-muted">{label}</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm" aria-label={`${value} / 5, ${label}`}>
      <span aria-hidden className="text-accent tracking-tight">
        {"★".repeat(Math.round(value))}
        <span className="text-line-strong">{"★".repeat(5 - Math.round(value))}</span>
      </span>
      <span className="font-semibold">{value.toFixed(1)}</span>
      <span className="text-muted">· {label}</span>
      {count === 0 && null}
    </span>
  );
}

export function DescriptionList({ items }: { items: { k: ReactNode; v: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      {items.map((it, i) => (
        <div key={i} className="contents">
          <dt className="text-muted">{it.k}</dt>
          <dd className="text-ink">{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}
