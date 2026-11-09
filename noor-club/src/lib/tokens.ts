import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * One-time tokens for password reset and e-mail verification.
 *
 * The raw token only ever exists in the e-mail. What we store is its SHA-256
 * hash, so a leaked database backup cannot be turned into account takeovers.
 * SHA-256 without a salt is right here (unlike for passwords): the input is 32
 * bytes of entropy, so there is nothing to brute-force or rainbow-table.
 */

export const RESET_TOKEN_TTL_MINUTES = 60;
export const VERIFY_TOKEN_TTL_HOURS = 24;

export function createToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time compare, so timing cannot be used to guess a token. */
export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

export function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 3_600_000);
}

/** A token is only usable while it is unused and unexpired. */
export function isUsable(record: { usedAt: Date | null; expiresAt: Date }): boolean {
  return record.usedAt === null && record.expiresAt.getTime() > Date.now();
}
