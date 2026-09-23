/**
 * Minimal structured JSON logger with redaction of sensitive fields.
 * We deliberately avoid a heavy logging dependency; the output is one JSON
 * object per line so it can be shipped to any log aggregator.
 */
type Level = "debug" | "info" | "warn" | "error" | "silent";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "tokenHash",
  "authorization",
  "cookie",
  "secret",
  "telegramChatId",
  "phone",
  "sellerPhone",
  "normalizedPhone",
  "email",
  "normalizedEmail",
  "sellerEmail",
  "recipient",
  "notes",
]);

export type LogFields = Record<string, unknown>;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth]";
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.has(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function currentLevel(): Level {
  const raw = process.env["LOG_LEVEL"];
  if (raw && raw in LEVELS) return raw as Level;
  return process.env["NODE_ENV"] === "test" ? "silent" : "info";
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  child(bindings: LogFields): Logger;
}

function emit(level: Level, bindings: LogFields, msg: string, fields?: LogFields): void {
  if (LEVELS[level] < LEVELS[currentLevel()]) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...(redact(bindings) as LogFields),
    ...(fields ? (redact(fields) as LogFields) : {}),
  });
  if (level === "error") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

export function createLogger(bindings: LogFields = {}): Logger {
  return {
    debug: (msg, fields) => emit("debug", bindings, msg, fields),
    info: (msg, fields) => emit("info", bindings, msg, fields),
    warn: (msg, fields) => emit("warn", bindings, msg, fields),
    error: (msg, fields) => emit("error", bindings, msg, fields),
    child: (extra) => createLogger({ ...bindings, ...extra }),
  };
}

export const logger = createLogger({ app: "immoradar" });

/** Exported for tests. */
export const __redactForTest = redact;
