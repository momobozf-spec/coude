import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";

/**
 * Rate limiting backed by the database rather than a module-level Map.
 *
 * On Vercel every serverless instance would have its own Map, so an attacker
 * only has to be spread across instances to get an unlimited number of tries.
 * A shared table costs one round trip and actually holds.
 *
 * Keys are hashed: this table must never become a list of who tried to log in
 * with which address, from which IP.
 */

export type RateLimitRule = {
  /** Namespace, e.g. "login:email". */
  scope: string;
  limit: number;
  windowMinutes: number;
};

export const RATE_LIMITS = {
  loginEmail: { scope: "login:email", limit: 10, windowMinutes: 15 },
  loginIp: { scope: "login:ip", limit: 10, windowMinutes: 15 },
  registerIp: { scope: "register:ip", limit: 5, windowMinutes: 60 },
  forgotEmail: { scope: "forgot:email", limit: 3, windowMinutes: 60 },
} as const satisfies Record<string, RateLimitRule>;

function keyFor(rule: RateLimitRule, subject: string): string {
  return `${rule.scope}:${createHash("sha256").update(subject).digest("hex").slice(0, 32)}`;
}

/** Best-effort client IP from the proxy headers Vercel sets. */
export async function clientIp(): Promise<string> {
  const header = await headers();
  const forwarded = header.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return header.get("x-real-ip") ?? "unknown";
}

export type RateLimitResult = { allowed: boolean; remaining: number };

/**
 * Reads the counter without touching it.
 *
 * Login checks first and only records on *failure*. Counting every attempt
 * would mean a correct password still burns budget, and the counter could then
 * never be cleared by signing in — an attacker could lock a family out of their
 * own account just by guessing at their address.
 */
export async function peek(rule: RateLimitRule, subject: string): Promise<RateLimitResult> {
  try {
    const existing = await db.rateLimit.findUnique({
      where: { key: keyFor(rule, subject) },
    });

    if (!existing || existing.windowEnd.getTime() <= Date.now()) {
      return { allowed: true, remaining: rule.limit };
    }

    return {
      allowed: existing.count < rule.limit,
      remaining: Math.max(0, rule.limit - existing.count),
    };
  } catch {
    return { allowed: true, remaining: rule.limit };
  }
}

/**
 * Counts one attempt against `subject`.
 *
 * Fails open: if the database is unreachable the user should still be able to
 * log in. A rate limiter is not worth turning a blip into an outage.
 */
export async function consume(
  rule: RateLimitRule,
  subject: string,
): Promise<RateLimitResult> {
  const key = keyFor(rule, subject);
  const now = new Date();

  try {
    const existing = await db.rateLimit.findUnique({ where: { key } });

    if (!existing || existing.windowEnd.getTime() <= now.getTime()) {
      const windowEnd = new Date(now.getTime() + rule.windowMinutes * 60_000);
      await db.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, windowEnd },
        update: { count: 1, windowEnd },
      });
      return { allowed: true, remaining: rule.limit - 1 };
    }

    if (existing.count >= rule.limit) {
      return { allowed: false, remaining: 0 };
    }

    const updated = await db.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
    return { allowed: true, remaining: Math.max(0, rule.limit - updated.count) };
  } catch {
    return { allowed: true, remaining: rule.limit };
  }
}

/** Wipes the counter after a success, so one good login clears the slate. */
export async function reset(rule: RateLimitRule, subject: string): Promise<void> {
  try {
    await db.rateLimit.deleteMany({ where: { key: keyFor(rule, subject) } });
  } catch {
    // A stale counter is harmless; it expires on its own.
  }
}
