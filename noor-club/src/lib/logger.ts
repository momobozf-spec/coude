import { createHash, randomUUID } from "node:crypto";

/**
 * Structured logging. Server-only — importing this from a client component is
 * meant to fail the build rather than ship `node:crypto` to a browser.
 *
 * Vercel parses one JSON object per line into searchable fields, so that is all
 * this needs to be. No dependency, no transport, no buffering.
 *
 * Nothing secret ever goes in: no tokens, no password hashes, no Stripe keys,
 * no whole e-mail addresses. Use `hashed()` for anything that identifies a
 * person, so lines can still be correlated without being readable.
 */

export type LogFields = Record<string, string | number | boolean | null | undefined>;

type Level = "info" | "warn" | "error";

/** Stable, non-reversible short digest — safe to put in a log line. */
export function hashed(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

/** `naam@voorbeeld.nl` -> `n***@***.nl`, for when a human has to read the line. */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const tld = domain.includes(".") ? domain.slice(domain.lastIndexOf(".")) : "";
  return `${local.slice(0, 1)}***@***${tld}`;
}

export function newCorrelationId(): string {
  return randomUUID();
}

function emit(level: Level, scope: string, correlationId: string, message: string, fields?: LogFields) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    scope,
    cid: correlationId,
    msg: message,
    ...fields,
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export type Logger = {
  readonly cid: string;
  info: (message: string, fields?: LogFields) => void;
  warn: (message: string, fields?: LogFields) => void;
  error: (message: string, fields?: LogFields) => void;
  /** Same correlation id, different scope — for a nested step. */
  child: (scope: string) => Logger;
};

export function logger(scope: string, correlationId: string = newCorrelationId()): Logger {
  return {
    cid: correlationId,
    info: (message, fields) => emit("info", scope, correlationId, message, fields),
    warn: (message, fields) => emit("warn", scope, correlationId, message, fields),
    error: (message, fields) => emit("error", scope, correlationId, message, fields),
    child: (childScope) => logger(childScope, correlationId),
  };
}

/** Turns an unknown catch value into something safe to log. */
export function describeError(error: unknown): LogFields {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message };
  }
  return { errorMessage: String(error).slice(0, 200) };
}
