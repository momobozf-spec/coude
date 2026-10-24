import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { requestIdOf } from './request-id.middleware';

/** Het foutobject dat elke client te zien krijgt. Nooit een stacktrace, nooit interne paden. */
export interface ApiErrorBody {
  readonly statusCode: number;
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly issues?: ReadonlyArray<{ path: string; message: string }>;
  readonly [extra: string]: unknown;
}

const CODE_BY_STATUS: Readonly<Record<number, string>> = Object.freeze({
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  503: 'UNAVAILABLE',
});

interface BodyParserError extends Error {
  readonly status: number;
  readonly type: string;
  readonly expose?: boolean;
}

function isBodyParserError(exception: unknown): exception is BodyParserError {
  if (!(exception instanceof Error)) return false;
  const candidate = exception as Partial<BodyParserError>;
  return typeof candidate.status === 'number' && candidate.status >= 400 && candidate.status < 500 && typeof candidate.type === 'string';
}

const BODY_PARSER_CODES: Readonly<Record<string, string>> = Object.freeze({
  'entity.too.large': 'PAYLOAD_TOO_LARGE',
  'entity.parse.failed': 'INVALID_JSON',
  'encoding.unsupported': 'UNSUPPORTED_ENCODING',
  'charset.unsupported': 'UNSUPPORTED_CHARSET',
  'request.aborted': 'REQUEST_ABORTED',
});

const BODY_PARSER_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  'entity.too.large': 'Het verzoek is te groot.',
  'entity.parse.failed': 'De inhoud van het verzoek is geen geldige JSON.',
  'encoding.unsupported': 'Deze inhoudscodering wordt niet ondersteund.',
  'charset.unsupported': 'Deze tekenset wordt niet ondersteund.',
  'request.aborted': 'Het verzoek is afgebroken.',
});

/**
 * Eén vorm voor elke fout. Bekende HttpExceptions behouden hun boodschap en
 * eventuele extra velden (zoals `issues` of `existingAlertId`); onbekende
 * fouten worden een generieke 500 met alleen een request-id — de details gaan
 * naar het log, niet naar de client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const requestId = requestIdOf(request);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiErrorBody = { statusCode: status, code: 'INTERNAL_ERROR', message: 'Er ging iets mis. Probeer het later opnieuw.', requestId };

    if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      body = { statusCode: status, code: 'RATE_LIMITED', message: 'Te veel verzoeken. Wacht even en probeer opnieuw.', requestId };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      const details = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
      const message =
        typeof payload === 'string'
          ? payload
          : typeof details['message'] === 'string'
            ? (details['message'] as string)
            : Array.isArray(details['message'])
              ? (details['message'] as string[]).join(', ')
              : exception.message;
      const { message: _m, statusCode: _s, error: _e, ...extras } = details;
      body = {
        ...extras,
        statusCode: status,
        code: typeof extras['code'] === 'string' ? (extras['code'] as string) : (CODE_BY_STATUS[status] ?? 'ERROR'),
        message,
        requestId,
      };
    } else if (isBodyParserError(exception)) {
      // body-parser gooit gewone Errors met een status: te groot, geen geldige JSON, verkeerde encoding.
      status = exception.status;
      body = { statusCode: status, code: BODY_PARSER_CODES[exception.type] ?? CODE_BY_STATUS[status] ?? 'BAD_REQUEST', message: BODY_PARSER_MESSAGES[exception.type] ?? 'Ongeldig verzoek.', requestId };
    } else {
      // Onbekende fout: volledig loggen (zonder geheimen, zie StructuredLogger), niets lekken.
      const error = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(`${error.name}: ${error.message} requestId=${requestId} path=${request.path}`, error.stack);
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS) response.setHeader('Retry-After', '60');
    response.status(status).json(body);
  }
}
