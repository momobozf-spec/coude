'use client';

/**
 * UI-primitieven van Superette. Alle kleuren via tokens uit `globals.css`;
 * elk interactief element heeft een zichtbare focusring en een aanraakvlak
 * van minstens 44 px hoog.
 */
import Link from 'next/link';
import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type Size = 'sm' | 'md' | 'lg';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-50 select-none';

const BUTTON_VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-strong',
  secondary: 'border border-hairline-strong bg-canvas-raised text-ink hover:bg-canvas-sunken',
  ghost: 'text-ink hover:bg-canvas-sunken',
  danger: 'border border-danger/40 text-danger hover:bg-danger-soft',
  accent: 'bg-accent text-accent-ink hover:bg-accent-strong',
};

const BUTTON_SIZES: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; full?: boolean }) {
  return (
    <button
      type={props.type ?? 'button'}
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${full ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** Een link die eruitziet als een knop. */
export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  full = false,
  className = '',
  children,
  ...props
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  full?: boolean;
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
}) {
  return (
    <Link href={href} className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${full ? 'w-full' : ''} ${className}`} {...props}>
      {children}
    </Link>
  );
}

export function Field({
  label,
  hint,
  error,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | undefined }) {
  const generated = useId();
  const id = props.id ?? props.name ?? generated;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        className="min-h-11 w-full rounded-xl border border-hairline-strong bg-canvas-raised px-3.5 py-2.5 text-ink placeholder:text-ink-muted/70 focus:border-brand focus:outline-none"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextareaField({
  label,
  hint,
  error,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string | undefined }) {
  const generated = useId();
  const id = props.id ?? props.name ?? generated;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <textarea
        id={id}
        className="min-h-24 w-full rounded-xl border border-hairline-strong bg-canvas-raised px-3.5 py-2.5 text-ink placeholder:text-ink-muted/70 focus:border-brand focus:outline-none"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  hint,
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; children: ReactNode }) {
  const generated = useId();
  const id = props.id ?? props.name ?? generated;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        id={id}
        className="min-h-11 w-full rounded-xl border border-hairline-strong bg-canvas-raised px-3.5 py-2.5 text-ink focus:border-brand focus:outline-none"
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
      >
        {children}
      </select>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Checkbox({
  label,
  hint,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: string }) {
  const generated = useId();
  const id = props.id ?? generated;
  return (
    <div className={className}>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5 text-sm leading-relaxed text-ink">
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 rounded border-hairline-strong accent-[var(--brand)]"
          aria-describedby={hint ? `${id}-hint` : undefined}
          {...props}
        />
        <span>{label}</span>
      </label>
      {hint && (
        <p id={`${id}-hint`} className="-mt-1 ml-8 text-xs text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Een groep radioknoppen als kaartjes. Toegankelijk: echte radio's, één naam, pijltjestoetsen werken. */
export function RadioCards<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
}: {
  name: string;
  legend: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; description?: string; disabled?: boolean }>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink">{legend}</legend>
      <div className="grid gap-2">
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors ${
                checked ? 'border-brand bg-brand-soft/60' : 'border-hairline bg-canvas-raised hover:bg-canvas-sunken'
              } ${option.disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
              />
              <span>
                <span className="block font-semibold text-ink">{option.label}</span>
                {option.description && <span className="block text-xs text-ink-muted">{option.description}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Card({ children, className = '', as: Tag = 'div', testId }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' | 'li'; testId?: string }) {
  return (
    <Tag data-testid={testId} className={`rounded-2xl border border-hairline bg-canvas-raised p-4 shadow-[var(--shadow)] ${className}`}>
      {children}
    </Tag>
  );
}

export type BadgeTone = 'neutral' | 'brand' | 'accent' | 'warning' | 'danger' | 'info' | 'demo';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-canvas-sunken text-ink border-hairline',
  brand: 'bg-brand-soft text-brand-strong border-transparent',
  accent: 'bg-accent-soft text-accent-strong border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  info: 'bg-info-soft text-info border-transparent',
  demo: 'bg-warning-soft text-warning border-warning/40 border-dashed',
};

export function Badge({ tone = 'neutral', children, title, className = '' }: { tone?: BadgeTone; children: ReactNode; title?: string; className?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Notice({ tone = 'info', children, className = '', role }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: ReactNode; className?: string; role?: 'alert' | 'status' }) {
  const tones = {
    info: 'border-info/30 bg-info-soft text-ink',
    warning: 'border-warning/40 bg-warning-soft text-ink',
    danger: 'border-danger/40 bg-danger-soft text-ink',
    success: 'border-accent/40 bg-accent-soft text-ink',
  } as const;
  return (
    <div role={role ?? (tone === 'danger' ? 'alert' : 'status')} className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${tones[tone]} ${className}`}>
      {children}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-hairline-strong px-6 py-10 text-center">
      {icon && <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-canvas-sunken text-ink-muted">{icon}</div>}
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {text && <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{text}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Statusmelding die schermlezers voorlezen zonder het beeld te veranderen. */
export function LiveRegion({ message }: { message: string | null }) {
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message ?? ''}
    </div>
  );
}

/**
 * Toegankelijke dialoog op het native <dialog>-element: focus gaat erin bij
 * openen, Escape sluit, focus keert terug naar de knop die hem opende.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closeLabel: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="m-auto w-[min(100%-2rem,32rem)] rounded-2xl border border-hairline bg-canvas-raised p-0 text-ink shadow-[var(--shadow)] backdrop:bg-black/40"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-canvas-sunken">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

/** Segmentknoppen met tab-semantiek. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex w-full rounded-xl border border-hairline bg-canvas-sunken p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors ${active ? 'bg-canvas-raised text-ink shadow-[var(--shadow)]' : 'text-ink-muted hover:text-ink'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Het logotype. Eén plek, zodat de merknaam nergens uit de pas loopt. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-[family-name:var(--font-display)] font-extrabold tracking-tight text-ink ${className}`}>
      <svg width="28" height="28" viewBox="0 0 512 512" aria-hidden="true" className="shrink-0">
        <rect width="512" height="512" rx="112" fill="var(--brand)" />
        <path d="M96 176h320l-16 56H112z" fill="var(--canvas)" />
        <path d="M152 280h208l-20 112H172z" fill="none" stroke="var(--canvas)" strokeWidth="22" strokeLinejoin="round" />
        <path d="M200 280l24-56M312 280l-24-56" stroke="var(--canvas)" strokeWidth="22" strokeLinecap="round" />
      </svg>
      <span>
        Super<span className="text-brand">ette</span>
      </span>
    </span>
  );
}

export function PageTitle({ children, lead }: { children: ReactNode; lead?: ReactNode }) {
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{children}</h1>
      {lead && <p className="mt-1.5 max-w-2xl text-sm text-ink-muted sm:text-base">{lead}</p>}
    </header>
  );
}
