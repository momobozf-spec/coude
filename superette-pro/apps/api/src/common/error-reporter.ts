/**
 * Foutmonitoring via `ERROR_REPORTING_DSN`.
 *
 * Spreekt het Sentry-envelopeprotocol (versie 7), dat ook door GlitchTip,
 * Bugsink en self-hosted Sentry wordt verstaan; er is geen SDK nodig en er
 * draait geen automatische instrumentatie. Alleen `error`- en `fatal`-regels
 * van de StructuredLogger worden verstuurd, na dezelfde redactie als de logs,
 * zonder request-body's, headers, e-mailadressen of IP-adressen.
 *
 * Best effort: een onbereikbare provider mag de API nooit vertragen of laten
 * falen (time-out 5 s, hoogstens 30 meldingen per minuut, fouten één keer per
 * minuut gelogd).
 */
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { redact } from './logger';

export interface ReportedError {
  readonly level: 'error' | 'fatal';
  readonly message: string;
  readonly stack?: string | undefined;
  readonly context?: string | undefined;
  readonly requestId?: string | undefined;
}

export interface ParsedDsn {
  readonly endpoint: string;
  readonly publicKey: string;
  readonly projectId: string;
}

/** `https://<key>@<host>[/<pad>]/<project>` → envelope-endpoint en sleutel. */
export function parseDsn(dsn: string): ParsedDsn {
  const url = new URL(dsn);
  const projectId = url.pathname.split('/').filter(Boolean).pop();
  if (!url.username || !projectId || !/^[a-z0-9]+$/i.test(projectId)) {
    throw new Error('ERROR_REPORTING_DSN is ongeldig: verwacht <protocol>://<sleutel>@<host>/<projectnummer>');
  }
  const base = url.pathname.slice(0, url.pathname.lastIndexOf(`/${projectId}`));
  return {
    endpoint: `${url.protocol}//${url.host}${base}/api/${projectId}/envelope/`,
    publicKey: url.username,
    projectId,
  };
}

interface Frame {
  readonly function: string;
  readonly filename: string;
  readonly lineno?: number;
  readonly colno?: number;
}

/** Node-stacktrace → Sentry-frames (oudste eerst), zonder gebruikersgegevens. */
export function framesFromStack(stack: string | undefined): Frame[] {
  if (!stack) return [];
  const frames: Frame[] = [];
  for (const line of stack.split('\n')) {
    const match = /^\s+at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?$/.exec(line);
    if (!match) continue;
    frames.push({ function: match[1] ?? '<anonymous>', filename: match[2] ?? '', lineno: Number(match[3]), colno: Number(match[4]) });
  }
  return frames.reverse();
}

export interface ErrorReporterOptions {
  readonly service: string;
  readonly environment: string;
  readonly version: string;
  readonly fetchImpl?: typeof fetch;
  readonly maxPerMinute?: number;
}

export function buildEvent(error: ReportedError, options: ErrorReporterOptions): Record<string, unknown> {
  const message = redact(error.message);
  const typeMatch = /^([A-Za-z0-9_$]*(?:Error|Exception)):\s*/.exec(message);
  const type = typeMatch?.[1] ?? 'Error';
  const value = typeMatch ? message.slice(typeMatch[0].length) : message;
  return {
    event_id: randomUUID().replace(/-/g, ''),
    timestamp: Date.now() / 1000,
    platform: 'node',
    level: error.level,
    logger: error.context ?? 'app',
    environment: options.environment,
    release: `${options.service}@${options.version}`,
    server_name: hostname(),
    tags: { service: options.service, ...(error.requestId ? { requestId: error.requestId } : {}) },
    exception: {
      values: [
        {
          type,
          value: redact(value).slice(0, 2000),
          stacktrace: { frames: framesFromStack(error.stack ? redact(error.stack) : undefined) },
        },
      ],
    },
  };
}

export class ErrorReporter {
  private readonly dsn: ParsedDsn;
  private readonly fetchImpl: typeof fetch;
  private readonly maxPerMinute: number;
  private windowStart = 0;
  private sentInWindow = 0;
  private lastFailureLog = 0;

  constructor(
    dsn: string,
    private readonly options: ErrorReporterOptions,
  ) {
    this.dsn = parseDsn(dsn);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxPerMinute = options.maxPerMinute ?? 30;
  }

  /** Bouwt de envelope (voor tests en om te zien wat er precies vertrekt). */
  envelope(error: ReportedError): string {
    const event = buildEvent(error, this.options);
    const header = { event_id: event['event_id'], sent_at: new Date().toISOString() };
    return `${JSON.stringify(header)}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify(event)}\n`;
  }

  /** Verstuurt op de achtergrond; faalt nooit richting de aanroeper. */
  report(error: ReportedError): void {
    const now = Date.now();
    if (now - this.windowStart > 60_000) {
      this.windowStart = now;
      this.sentInWindow = 0;
    }
    if (this.sentInWindow >= this.maxPerMinute) return;
    this.sentInWindow++;

    void this.send(this.envelope(error)).catch((cause: unknown) => {
      if (now - this.lastFailureLog < 60_000) return;
      this.lastFailureLog = now;
      process.stderr.write(`${JSON.stringify({ time: new Date().toISOString(), level: 'warn', context: 'ErrorReporter', message: `foutmonitoring onbereikbaar: ${redact(cause instanceof Error ? cause.message : String(cause))}` })}\n`);
    });
  }

  private async send(body: string): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await this.fetchImpl(this.dsn.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-sentry-envelope',
          'x-sentry-auth': `Sentry sentry_version=7, sentry_client=${this.options.service}/${this.options.version}, sentry_key=${this.dsn.publicKey}`,
        },
        body,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`provider antwoordde ${response.status}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
