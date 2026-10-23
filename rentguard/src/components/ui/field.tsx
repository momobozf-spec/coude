import * as React from 'react';

import { cn } from '@/lib/utils';

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }
>(({ className, children, required, ...props }, ref) => (
  <label
    ref={ref}
    className={cn('block text-sm font-medium text-slate-900', className)}
    {...props}
  >
    {children}
    {required ? <span className="ml-1 text-red-600">*</span> : null}
  </label>
));
Label.displayName = 'Label';

const controlStyles =
  'w-full rounded-lg border border-slate-300 bg-white px-3 text-base ' +
  'text-slate-900 placeholder:text-slate-400 ' +
  'focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 ' +
  'aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-500';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(controlStyles, 'h-11', className)} {...props} />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(controlStyles, 'min-h-24 py-2', className)}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(controlStyles, 'h-11', className)} {...props} />
));
Select.displayName = 'Select';

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={cn(
      'mt-0.5 size-5 shrink-0 rounded border-slate-400 text-slate-900',
      'focus:ring-2 focus:ring-slate-900 focus:ring-offset-1',
      className,
    )}
    {...props}
  />
));
Checkbox.displayName = 'Checkbox';

export interface FieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  /** Uitleg onder het veld. Gebruik dit voor juridische duiding. */
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
}

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: FieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {React.isValidElement<Record<string, unknown>>(children)
        ? React.cloneElement(children, {
            id: htmlFor,
            'aria-invalid': error ? true : undefined,
            'aria-describedby':
              [hintId, errorId].filter(Boolean).join(' ') || undefined,
          })
        : children}
      {hint ? (
        <p id={hintId} className="text-sm text-slate-600">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
