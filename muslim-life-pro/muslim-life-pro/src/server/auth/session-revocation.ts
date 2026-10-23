/**
 * True when a session predates the member's last password change.
 *
 * A session without an `authAt` claim (issued before this check existed)
 * counts as revoked once a password has been changed. Pure, so it is
 * unit-tested directly; `getActor` applies it on every request.
 */
export function isSessionRevoked(
  authAtSeconds: number | undefined,
  passwordChangedAt: Date | null,
): boolean {
  if (!passwordChangedAt) return false
  if (!authAtSeconds) return true
  // One second of slack: both stamps can fall inside the same request flow.
  return authAtSeconds * 1000 < passwordChangedAt.getTime() - 1000
}
