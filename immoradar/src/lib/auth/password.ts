/** Password hashing with Node's built-in scrypt — no external dependencies. */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_COST }).toString("hex");
  return `scrypt$${SCRYPT_COST}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const cost = parseInt(parts[1]!, 10);
  const salt = parts[2]!;
  const expected = Buffer.from(parts[3]!, "hex");
  if (!Number.isFinite(cost) || salt.length === 0 || expected.length !== SCRYPT_KEYLEN) return false;
  const actual = scryptSync(password, salt, SCRYPT_KEYLEN, { N: cost });
  return timingSafeEqual(actual, expected);
}
