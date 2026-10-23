import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-border bg-muted text-muted-foreground',
        primary: 'border-transparent bg-primary-subtle text-primary-subtle-foreground',
        accent: 'border-transparent bg-accent-subtle text-accent-subtle-foreground',
        success: 'border-transparent bg-success-subtle text-success',
        warning: 'border-transparent bg-warning-subtle text-warning',
        danger: 'border-transparent bg-danger-subtle text-danger',
        outline: 'border-border-strong bg-transparent text-foreground',
        solid: 'border-transparent bg-primary text-primary-foreground',
      },
      size: {
        sm: 'px-2 py-0.5 text-[0.6875rem]',
        md: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

interface BadgeProps extends React.ComponentProps<'span'>, VariantProps<typeof badgeVariants> {
  asChild?: boolean
}

function Badge({ className, variant, size, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : 'span'
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
