import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium ' +
    'transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-offset-2 focus-visible:ring-slate-900 ' +
    'disabled:pointer-events-none disabled:opacity-50 ' +
    '[&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-slate-900 text-white hover:bg-slate-800',
        secondary:
          'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50',
        ghost: 'text-slate-700 hover:bg-slate-100',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        link: 'text-slate-900 underline underline-offset-4 hover:text-slate-600',
      },
      size: {
        // Minimaal 44px hoog: dit is een app die mensen met één hand in een
        // lege woning gebruiken.
        default: 'h-11 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-12 px-6 text-base',
        icon: 'h-11 w-11',
      },
      full: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, full, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, full }), className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export { buttonVariants };
