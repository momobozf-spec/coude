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
  'inline-flex items-center justify-center gap-2 rounded-[14px] font-semibold transition-[background-color,transform] active:scale-[0.98] ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 select-none';

const BUTTON_VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-strong',
  secondary: 'border border-hairline-strong bg-canvas-raised text-ink hover:bg-canvas-sunken',
  ghost: 'text-brand-strong hover:bg-brand-soft',
  danger: 'border border-danger/40 text-danger hover:bg-danger-soft',
  accent: 'bg-accent text-accent-ink hover:bg-accent-strong',
};

const BUTTON_SIZES: Record<Size, string> = {
  sm: 'min-h-10 px-3.5 text-sm',
  md: 'min-h-12 px-4 text-[15px]',
  lg: 'min-h-13 px-6 text-base',
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
        className="min-h-12 w-full rounded-xl border border-hairline-strong bg-canvas-raised px-3.5 py-2.5 text-base text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
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
        className="min-h-24 w-full rounded-xl border border-hairline-strong bg-canvas-raised px-3.5 py-2.5 text-base text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
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
        className="min-h-12 w-full rounded-xl border border-hairline-strong bg-canvas-raised px-3.5 py-2.5 text-base text-ink focus:border-brand focus:outline-none"
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

export function Card({
  children,
  className = '',
  as: Tag = 'div',
  testId,
  'aria-labelledby': labelledBy,
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
  testId?: string;
  'aria-labelledby'?: string;
}) {
  return (
    <Tag data-testid={testId} aria-labelledby={labelledBy} className={`rounded-[18px] border border-hairline bg-canvas-raised p-4 shadow-[var(--shadow)] ${className}`}>
      {children}
    </Tag>
  );
}

export type BadgeTone = 'neutral' | 'brand' | 'accent' | 'warning' | 'danger' | 'info' | 'demo' | 'promo';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-canvas-sunken text-ink border-hairline',
  brand: 'bg-brand-soft text-brand-strong border-transparent',
  accent: 'bg-accent-soft text-accent-strong border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  info: 'bg-info-soft text-info border-transparent',
  // DEMO blijft altijd herkenbaar: gestreepte rand, eigen kleur, ook in donker.
  demo: 'bg-warning-soft text-warning border-warning/60 border-dashed font-bold',
  promo: 'bg-promo-soft text-promo-text border-transparent',
};

export function Badge({ tone = 'neutral', children, title, className = '' }: { tone?: BadgeTone; children: ReactNode; title?: string; className?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-px text-xs font-semibold leading-5 ${BADGE_TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

const NOTICE_ICON = {
  info: 'M12 8h.01M11 12h1v4h1',
  warning: 'M12 9v4m0 3h.01',
  danger: 'M12 9v4m0 3h.01',
  success: 'm8.5 12.5 2.5 2.5 4.5-5',
} as const;

export function Notice({ tone = 'info', children, className = '', role, size = 'md' }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: ReactNode; className?: string; role?: 'alert' | 'status'; size?: 'sm' | 'md' }) {
  const tones = {
    info: 'bg-info-soft text-ink [--notice:var(--info)]',
    warning: 'bg-warning-soft text-ink [--notice:var(--warning)]',
    danger: 'bg-danger-soft text-ink [--notice:var(--danger)]',
    success: 'bg-accent-soft text-ink [--notice:var(--accent-strong)]',
  } as const;
  return (
    <div role={role ?? (tone === 'danger' ? 'alert' : 'status')} className={`flex gap-2.5 rounded-xl ${size === 'sm' ? 'px-3 py-2 text-[13px] leading-snug' : 'px-3.5 py-3 text-sm leading-relaxed'} ${tones[tone]} ${className}`}>
      <svg width={size === 'sm' ? 18 : 20} height={size === 'sm' ? 18 : 20} viewBox="0 0 24 24" fill="none" stroke="var(--notice)" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="mt-px shrink-0">
        <circle cx="12" cy="12" r="9" />
        <path d={NOTICE_ICON[tone]} />
      </svg>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[18px] border border-dashed border-hairline-strong bg-canvas-raised/60 px-6 py-10 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong" aria-hidden="true">
        {icon ?? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5h2l2.2 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L19.5 8H6" />
            <circle cx="9" cy="20" r="1.2" />
            <circle cx="17" cy="20" r="1.2" />
          </svg>
        )}
      </div>
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {text && <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{text}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
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
 * openen, Escape sluit, focus keert terug naar de knop die hem opende. Op een
 * telefoon is het een bodemblad (duim-bereik), op grotere schermen een venster.
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
      className="sheet mx-auto mb-0 mt-auto max-h-[92dvh] w-full max-w-full rounded-t-[24px] border border-hairline bg-canvas-raised p-0 text-ink shadow-[var(--shadow)] backdrop:bg-black/50 md:m-auto md:w-[min(100%-2rem,32rem)] md:rounded-[20px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="pb-safe">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-hairline-strong md:hidden" aria-hidden="true" />
        <div className="p-5 pt-3 md:pt-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id={titleId} className="display text-2xl">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label={closeLabel} className="-mr-1 flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-canvas-sunken">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    </dialog>
  );
}

/** Segmentknoppen (aria-pressed): één keuze uit enkele. */
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
    <div role="group" aria-label={label} className="flex w-full gap-1 rounded-[14px] bg-canvas-sunken p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`min-h-11 flex-1 rounded-[10px] px-2 text-[13px] font-semibold leading-tight transition-colors ${active ? 'bg-canvas-raised text-ink shadow-[var(--shadow)]' : 'text-ink-muted hover:text-ink'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Het beeldmerk: een schapkaartje. Kleur via `currentColor`, zodat het op de groene balk én op papier werkt. */
export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--tag)" />
      <circle cx="7.5" cy="16" r="2.2" fill="var(--tag-ink)" opacity="0.85" />
      <path d="M13 11.5h11M13 16h11M13 20.5h7" stroke="var(--tag-ink)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** Het logotype. Eén plek, zodat de merknaam nergens uit de pas loopt. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className="size-7" />
      <span className="display text-[1.4em] leading-none tracking-tight">Superette</span>
    </span>
  );
}

export function PageTitle({ children, lead, action }: { children: ReactNode; lead?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[2rem] text-ink sm:text-[2.5rem]">{children}</h1>
        {lead && <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">{lead}</p>}
      </div>
      {action}
    </header>
  );
}

/** Kopje van een sectie, met optioneel een link rechts. */
export function SectionTitle({ id, children, action }: { id?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <h2 id={id} className="display text-[1.5rem] text-ink">
        {children}
      </h2>
      {action}
    </div>
  );
}
