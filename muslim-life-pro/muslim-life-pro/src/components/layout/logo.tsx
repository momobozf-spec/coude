import Link from 'next/link'

import { cn } from '@/lib/utils'
import { siteConfig } from '@/config/site'

/**
 * The mark: an eight-point star (najmat thumaniyya) reduced to two overlaid
 * squares. Geometric, restrained, and legible at 20px — Islamic influence as
 * structure rather than ornament.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn('size-8', className)}
      aria-hidden
      focusable="false"
    >
      <rect
        x="5.5"
        y="5.5"
        width="21"
        height="21"
        rx="4.5"
        className="stroke-primary"
        strokeWidth="2"
      />
      <rect
        x="5.5"
        y="5.5"
        width="21"
        height="21"
        rx="4.5"
        transform="rotate(45 16 16)"
        className="stroke-primary"
        strokeWidth="2"
        opacity="0.45"
      />
      <circle cx="16" cy="16" r="2.75" className="fill-accent" />
    </svg>
  )
}

interface LogoProps {
  className?: string
  href?: string
  showWordmark?: boolean
}

export function Logo({ className, href = '/', showWordmark = true }: LogoProps) {
  const content = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {showWordmark ? (
        <span className="text-[0.9375rem] font-semibold tracking-[-0.015em] text-foreground">
          {siteConfig.name}
        </span>
      ) : null}
    </span>
  )

  if (!href) return content

  return (
    <Link href={href} className="rounded-lg" aria-label={siteConfig.name}>
      {content}
    </Link>
  )
}
