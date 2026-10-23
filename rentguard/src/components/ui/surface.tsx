import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-5 shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description ? (
          <p className="text-sm text-slate-600">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

const alertVariants = cva('rounded-lg border p-4 text-sm', {
  variants: {
    tone: {
      info: 'border-slate-200 bg-slate-50 text-slate-800',
      warning: 'border-amber-300 bg-amber-50 text-amber-900',
      critical: 'border-red-300 bg-red-50 text-red-900',
      success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    },
  },
  defaultVariants: { tone: 'info' },
});

export interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof alertVariants> {
  title?: React.ReactNode;
}

export function Alert({ className, tone, title, children, ...props }: AlertProps) {
  return (
    <div
      role="note"
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      <div className="space-y-2 [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </div>
    </div>
  );
}

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-slate-100 text-slate-700',
        verified: 'bg-emerald-100 text-emerald-800',
        unverified: 'bg-amber-100 text-amber-900',
        stale: 'bg-orange-100 text-orange-900',
        critical: 'bg-red-100 text-red-800',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
