/**
 * Inlogvergrendeling — pure regels, zonder database.
 *
 * Elke `maxAttempts` mislukte pogingen gaat het account op slot: eerst
 * `lockMinutes`, daarna telkens het dubbele, tot maximaal een dag. Na een dag
 * zonder nieuwe vergrendeling begint de teller opnieuw; anders volstaan vijf
 * pogingen per dag om een bekend adres permanent buiten te houden.
 */

export interface LockoutPolicy {
  maxAttempts: number
  lockMinutes: number
}

export const LOCKOUT_DECAY_MS = 24 * 60 * 60_000
const MAX_LOCK_MINUTES = 24 * 60

/** Wachttijd in minuten die hoort bij deze teller, of null als er geen slot volgt. */
export function lockMinutesForCount(failedLoginCount: number, policy: LockoutPolicy): number | null {
  if (failedLoginCount < policy.maxAttempts) return null
  if (failedLoginCount % policy.maxAttempts !== 0) return null

  const rounds = failedLoginCount / policy.maxAttempts - 1
  return Math.min(policy.lockMinutes * 2 ** rounds, MAX_LOCK_MINUTES)
}

export function isLocked(lockedUntil: Date | null | undefined, now: Date): boolean {
  return Boolean(lockedUntil && lockedUntil.getTime() > now.getTime())
}
