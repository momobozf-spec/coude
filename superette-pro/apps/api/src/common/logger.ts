/**
 * Gestructureerde logging met redactie.
 *
 * Elke regel is één JSON-object (of, lokaal, één leesbare regel) met
 * timestamp, level, service, omgeving, versie en context. Wat er ook in een
 * boodschap belandt — een Bearer-token, een cookie, een wachtwoordveld, een
 * jobsleutel, een databaseverbinding — wordt vóór het schrijven gemaskeerd.
 * Redactie is een vangnet; de regel blijft: log zulke waarden nooit.
 */
import { LogLevel, type LoggerService } from '@nestjs/common';

export type LogFormat = 'json' | 'pretty';

export interface LogContext {
  readonly service: string;
  readonly environment: string;
  readonly version: string;
}

const REDACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]'],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[jwt-redacted]'],
  [/(["']?(?:password|wachtwoord|passwd|secret|token|refresh|api[_-]?key|job[_-]?key|authorization|cookie|set-cookie)["']?\s*[:=]\s*)(["']?)(?!Bearer\b|\[redacted\]|\[jwt-redacted\])[^"',;\s}]+\2/gi, '$1[redacted]'],
  [/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, '$1[redacted]@'],
  // Request-id's blijven zichtbaar: die zijn juist bedoeld om logregels te correleren.
  [/(x-job-key|authorization)\s*[:=]\s*(?!Bearer\b|\[redacted\])\S+/gi, '$1: [redacted]'],
];

export function redact(input: string): string {
  let output = input;
  for (const [pattern, replacement] of REDACTIONS) output = output.replace(pattern, replacement);
  return output;
}

function levelOf(level: LogLevel | 'info'): string {
  return level === 'log' ? 'info' : level;
}

/** Ontvangt elke error/fatal-regel (na redactie), bv. de foutmonitoring. */
export type ErrorSink = (entry: { level: 'error' | 'fatal'; message: string; stack?: string | undefined; context?: string | undefined; requestId?: string | undefined }) => void;

export class StructuredLogger implements LoggerService {
  private readonly levels: ReadonlySet<string>;
  private sink: ErrorSink | null = null;

  constructor(
    private readonly context: LogContext,
    private readonly format: LogFormat,
    levels: readonly LogLevel[] = ['log', 'warn', 'error', 'fatal'],
  ) {
    this.levels = new Set(levels);
  }

  /** Koppelt de foutmonitoring; de logger zelf blijft de bron van waarheid. */
  attachErrorSink(sink: ErrorSink): void {
    this.sink = sink;
  }

  log(message: unknown, ...optional: unknown[]): void {
    this.write('log', message, optional);
  }
  error(message: unknown, ...optional: unknown[]): void {
    this.write('error', message, optional);
  }
  warn(message: unknown, ...optional: unknown[]): void {
    this.write('warn', message, optional);
  }
  debug(message: unknown, ...optional: unknown[]): void {
    this.write('debug', message, optional);
  }
  verbose(message: unknown, ...optional: unknown[]): void {
    this.write('verbose', message, optional);
  }
  fatal(message: unknown, ...optional: unknown[]): void {
    this.write('fatal', message, optional);
  }

  /** Een logregel met expliciete velden, bv. een HTTP-request of een jobresultaat. */
  event(level: LogLevel, fields: Record<string, unknown>): void {
    if (!this.levels.has(level)) return;
    this.emit(level, fields);
  }

  private write(level: LogLevel, message: unknown, optional: unknown[]): void {
    if (!this.levels.has(level)) return;
    // Nest geeft de context (klassenaam) als laatste optionele parameter mee;
    // bij `error(message, stack, context)` zit de stacktrace ervoor.
    const context = optional.length > 0 && typeof optional.at(-1) === 'string' ? (optional.at(-1) as string) : undefined;
    const stack = optional.find((value) => typeof value === 'string' && /\n\s+at\s/.test(value)) as string | undefined;
    const text = message instanceof Error ? `${message.name}: ${message.message}` : typeof message === 'string' ? message : JSON.stringify(message);
    const redacted = redact(text);
    this.emit(level, { context, message: redacted });

    if (this.sink && (level === 'error' || level === 'fatal')) {
      const requestId = /requestId=([A-Za-z0-9-]+)/.exec(redacted)?.[1];
      try {
        this.sink({ level, message: redacted, stack: stack ? redact(stack) : message instanceof Error && message.stack ? redact(message.stack) : undefined, context, requestId });
      } catch {
        // De monitoring mag het loggen zelf nooit breken.
      }
    }
  }

  private emit(level: LogLevel, fields: Record<string, unknown>): void {
    const record = {
      time: new Date().toISOString(),
      level: levelOf(level),
      service: this.context.service,
      env: this.context.environment,
      version: this.context.version,
      ...fields,
    };

    const line = this.format === 'json' ? redact(JSON.stringify(record)) : prettyLine(record);
    const stream = level === 'error' || level === 'fatal' ? process.stderr : process.stdout;
    stream.write(`${line}\n`);
  }
}

function prettyLine(record: Record<string, unknown>): string {
  const { time, level, context, message, ...rest } = record as Record<string, unknown> & { time: string; level: string };
  const extras = Object.entries(rest)
    .filter(([key]) => !['service', 'env', 'version'].includes(key))
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' ');
  return redact(`${time} ${String(level).toUpperCase().padEnd(5)} ${context ? `[${String(context)}] ` : ''}${message ?? ''}${extras ? ` ${extras}` : ''}`);
}
