/**
 * Shared primitive types for the domain layer.
 * This file has no dependencies and no platform imports.
 */

export type Language = 'nl' | 'en' | 'fr';
export const SUPPORTED_LANGUAGES: readonly Language[] = ['nl', 'en', 'fr'] as const;

/** ISO-8601 calendar date, e.g. "2026-09-28". */
export type ISODate = string;
/** 24h clock time, e.g. "14:00". */
export type ClockTime = string;
/** Full ISO-8601 timestamp with offset, e.g. "2026-09-28T14:00:00+02:00". */
export type ISODateTime = string;

export type DayPart = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface Recurrence {
  frequency: RecurrenceFrequency;
  interval: number;
  /** ISO weekdays for WEEKLY recurrences. */
  byWeekday?: Weekday[];
  /** e.g. 1 for "first Monday of the month", -1 for "last". */
  bySetPosition?: number;
  /** ISO date after which the recurrence ends. */
  until?: ISODate;
}

export type InputSource = 'voice' | 'text' | 'siri' | 'shortcut' | 'widget' | 'notification' | 'share';

export type Result<T, E = DomainError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/**
 * Error codes that the UI maps to human-readable, localised messages.
 * Keep this list in sync with `src/core/errors/messages.ts`.
 */
export type DomainErrorCode =
  | 'MIC_PERMISSION_DENIED'
  | 'SPEECH_RECOGNITION_FAILED'
  | 'SPEECH_NOT_AVAILABLE'
  | 'CALENDAR_PERMISSION_DENIED'
  | 'REMINDERS_PERMISSION_DENIED'
  | 'NOTIFICATION_PERMISSION_DENIED'
  | 'ALARM_PERMISSION_DENIED'
  | 'ALARM_NOT_SUPPORTED'
  | 'AI_UNAVAILABLE'
  | 'AI_INVALID_OUTPUT'
  | 'NO_INTERNET'
  | 'AMBIGUOUS_COMMAND'
  | 'INVALID_DATE'
  | 'PAST_DATE'
  | 'DUPLICATE_ACTION'
  | 'EXTERNAL_ITEM_DELETED'
  | 'NOT_FOUND'
  | 'DB_MIGRATION_FAILED'
  | 'DB_ERROR'
  | 'VALIDATION_FAILED'
  | 'UNDO_NOT_POSSIBLE'
  | 'CONFIRMATION_REQUIRED'
  | 'PROFILE_INCOMPLETE'
  | 'EMAIL_UNAVAILABLE'
  | 'PDF_UNAVAILABLE'
  | 'TOOL_NOT_FOUND'
  | 'INVALID_ARGUMENTS'
  | 'EXTRACTION_UNCERTAIN'
  | 'FINANCIAL_SAFETY'
  | 'JOB_LEASE_LOST'
  | 'APPROVAL_REQUIRED'
  | 'ROLE_NOT_ALLOWED'
  | 'HOME_NOT_CONNECTED'
  | 'HOME_SAFETY'
  | 'REPO_UNAVAILABLE'
  | 'SERVER_UNAVAILABLE'
  | 'TICKET_STATE'
  | 'UNKNOWN';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details: Record<string, unknown> | undefined;
  override readonly cause: unknown;

  constructor(code: DomainErrorCode, message?: string, options?: { details?: Record<string, unknown>; cause?: unknown }) {
    super(message ?? code);
    this.name = 'DomainError';
    this.code = code;
    this.details = options?.details;
    this.cause = options?.cause;
  }

  static from(error: unknown, fallback: DomainErrorCode = 'UNKNOWN'): DomainError {
    if (error instanceof DomainError) return error;
    const message = error instanceof Error ? error.message : String(error);
    return new DomainError(fallback, message, { cause: error });
  }
}

export function isDomainError(value: unknown): value is DomainError {
  return value instanceof DomainError;
}

export function assertNever(value: never, message = `Unexpected value: ${String(value)}`): never {
  throw new Error(message);
}
