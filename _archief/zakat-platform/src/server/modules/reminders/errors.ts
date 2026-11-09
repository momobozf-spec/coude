import { AppError } from '@/lib/errors'

/** Reminder, notification and report domain errors (§41). */

export class ReminderNotFoundError extends AppError {
  constructor(message = 'Deze herinnering bestaat niet.') {
    super(message, { status: 404, code: 'REMINDER_NOT_FOUND' })
  }
}

export class InvalidRecurrenceInputError extends AppError {
  constructor(message = 'Deze herhaling is niet geldig.') {
    super(message, { status: 422, code: 'INVALID_RECURRENCE' })
  }
}

export class InvalidTimezoneInputError extends AppError {
  constructor(message = 'Kies een geldige tijdzone.') {
    super(message, { status: 422, code: 'INVALID_TIMEZONE' })
  }
}

export class InvalidCalendarDateInputError extends AppError {
  constructor(message = 'Deze kalenderdatum is niet geldig.') {
    super(message, { status: 422, code: 'INVALID_CALENDAR_DATE' })
  }
}

export class NotificationNotFoundError extends AppError {
  constructor(message = 'Deze melding bestaat niet.') {
    super(message, { status: 404, code: 'NOTIFICATION_NOT_FOUND' })
  }
}

export class ReportNotAvailableError extends AppError {
  constructor(message = 'Dit rapport is niet beschikbaar.') {
    super(message, { status: 404, code: 'REPORT_NOT_AVAILABLE' })
  }
}

export class ReportGenerationFailedError extends AppError {
  constructor(message = 'Het rapport kon niet gegenereerd worden.') {
    super(message, { status: 500, code: 'REPORT_GENERATION_FAILED' })
  }
}
