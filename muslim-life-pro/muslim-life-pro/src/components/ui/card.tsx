import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const cardVariants = cva('rounded-xl transition-shadow duration-300', {
  variants: {
    variant: {
      default: 'bg-surface border border-border shadow-sm',
      raised: 'bg-surface-raised border border-border shadow-md',
      flat: 'bg-surface border border-border',
      sunken: 'bg-surface-sunken border border-border',
      ghost: 'bg-transparent',
    },
    interactive: {
      true: 'hover:shadow-md hover:border-border-strong cursor-pointer',
      false: '',
    },
  },
  defaultVariants: { variant: 'default', interactive: false },
})

interface CardProps extends React.ComponentProps<'div'>, VariantProps<typeof cardVariants> {}

function Card({ className, variant, interactive, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant, interactive }), className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex flex-col gap-1.5 p-5 pb-3', className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      data-slot="card-title"
      className={cn('text-[0.9375rem] font-semibold leading-tight tracking-[-0.01em]', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-sm text-muted-foreground leading-relaxed', className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('p-5 pt-0', className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center gap-3 p-5 pt-0', className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants }
