import { BadgeCheck, FlaskConical, Lock, ShieldQuestion, UserCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

/**
 * Trust badges.
 *
 * The whole point of this component is that a `VERIFIED` badge means a human
 * checked, on a date. Seed data can never reach it — the seeder writes
 * `DEMO`, and a test asserts that no demo row is ever verified.
 */
export function VerificationBadge({
  verification,
  isDemo,
  lastVerifiedAt,
  size = 'sm',
}: {
  verification: string
  isDemo: boolean
  lastVerifiedAt?: Date | null
  size?: 'sm' | 'md'
}) {
  if (isDemo || verification === 'DEMO') {
    return (
      <Badge variant="default" size={size} title="Illustrative listing, not a real business">
        <FlaskConical />
        Demo listing
      </Badge>
    )
  }

  if (verification === 'VERIFIED') {
    return (
      <Badge
        variant="success"
        size={size}
        title={
          lastVerifiedAt
            ? `Confirmed by Muslim Life on ${lastVerifiedAt.toISOString().slice(0, 10)}`
            : 'Confirmed by Muslim Life'
        }
      >
        <BadgeCheck />
        Verified
      </Badge>
    )
  }

  if (verification === 'SELF_REPORTED') {
    return (
      <Badge variant="outline" size={size} title="Details provided by the business itself">
        <UserCheck />
        Owner listed
      </Badge>
    )
  }

  return (
    <Badge variant="outline" size={size} title="We have not confirmed these details">
      <ShieldQuestion />
      Unverified
    </Badge>
  )
}

export function OpenStateBadge({
  isOpen,
  label,
  size = 'sm',
}: {
  isOpen: boolean
  label: string
  size?: 'sm' | 'md'
}) {
  // Never colour alone: the word "Open"/"Closed" carries the meaning for anyone
  // who cannot distinguish the hues.
  return (
    <Badge variant={isOpen ? 'success' : 'default'} size={size}>
      <span
        className={isOpen ? 'size-1.5 rounded-full bg-success' : 'size-1.5 rounded-full bg-muted-foreground'}
        aria-hidden
      />
      {label}
    </Badge>
  )
}

export function PremiumDealBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <Badge variant="accent" size={size}>
      <Lock />
      Premium
    </Badge>
  )
}
