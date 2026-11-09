/**
 * Tiny structured logger. The platform layer installs a sink (console in dev,
 * a ring buffer for the diagnostics screen). Never logs transcript text at
 * levels above debug, to keep personal content out of crash reports.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  scope: string;
  message: string;
  meta: Record<string, unknown> | undefined;
  at: string;
}

export type LogSink = (entry: LogEntry) => void;

const sinks: LogSink[] = [];
let minLevel: LogLevel = 'debug';
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export function addLogSink(sink: LogSink): () => void {
  sinks.push(sink);
  return () => {
    const i = sinks.indexOf(sink);
    if (i >= 0) sinks.splice(i, 1);
  };
}

export function setMinLogLevel(level: LogLevel): void {
  minLevel = level;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(scope: string): Logger;
}

function emit(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>): void {
  if (ORDER[level] < ORDER[minLevel]) return;
  const entry: LogEntry = { level, scope, message, meta, at: new Date().toISOString() };
  for (const sink of sinks) {
    try {
      sink(entry);
    } catch {
      // a broken sink must never break the app
    }
  }
}

export function createLogger(scope: string): Logger {
  return {
    debug: (m, meta) => emit('debug', scope, m, meta),
    info: (m, meta) => emit('info', scope, m, meta),
    warn: (m, meta) => emit('warn', scope, m, meta),
    error: (m, meta) => emit('error', scope, m, meta),
    child: (sub) => createLogger(`${scope}:${sub}`),
  };
}

/** In-memory ring buffer sink for the diagnostics screen. */
export function createRingBufferSink(capacity = 300): { sink: LogSink; entries: () => LogEntry[]; clear: () => void } {
  const buffer: LogEntry[] = [];
  return {
    sink: (entry) => {
      buffer.push(entry);
      if (buffer.length > capacity) buffer.shift();
    },
    entries: () => [...buffer],
    clear: () => {
      buffer.length = 0;
    },
  };
}
