'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const base =
    'inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-medium tracking-wide ' +
    'transition-colors disabled:cursor-not-allowed disabled:opacity-45 ' +
    // Zichtbare focus-ring: een onbemande winkel wordt ook met een schermlezer
    // en toetsenbord bediend.
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong';

  const variants = {
    primary: 'bg-accent text-accent-ink hover:bg-accent-strong',
    ghost: 'border border-hairline text-ink hover:bg-canvas-raised',
    danger: 'border border-danger/40 text-danger hover:bg-danger/10',
  } as const;

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = props.id ?? props.name;

  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ink-muted">{label}</span>
      <input
        id={id}
        className="w-full rounded-xl border border-hairline bg-canvas-sunken px-4 py-3.5 text-ink placeholder:text-ink-muted/50 focus:border-accent focus:outline-none"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      />
      {hint && !error && (
        <span id={`${id}-hint`} className="mt-1.5 block text-xs text-ink-muted">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} role="alert" className="mt-1.5 block text-xs text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

export function Checkbox({
  label,
  required,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; required?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink">
      <input
        type="checkbox"
        required={required}
        className="mt-0.5 size-5 shrink-0 rounded border-hairline bg-canvas-sunken accent-[var(--accent)]"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}

export function Card({
  children,
  className = '',
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className={`rounded-2xl border border-hairline bg-canvas-raised p-5 ${className}`}>
      {children}
    </div>
  );
}

export function Alert({ children, tone = 'danger' }: { children: ReactNode; tone?: 'danger' | 'success' }) {
  const tones = {
    danger: 'border-danger/40 bg-danger/10 text-danger',
    success: 'border-success/40 bg-success/10 text-success',
  } as const;

  return (
    <div role="alert" className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

/** Het serif-logotype. Eén plek, zodat de merknaam nergens uit de pas loopt. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-[family-name:var(--font-display)] tracking-wide ${className}`}>
      Jamal <span className="text-accent">&</span> Jamila
    </span>
  );
}
