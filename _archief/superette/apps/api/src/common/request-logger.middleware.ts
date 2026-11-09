import type { NextFunction, Request, Response } from 'express';
import type { StructuredLogger } from './logger';
import { requestIdOf } from './request-id.middleware';

/**
 * Eén logregel per afgehandelde request: methode, pad, status, duur, request-id
 * en — als bekend — het pseudonieme gebruikers-id. Geen querystring, geen body,
 * geen headers: daar zitten zoektermen, wachtwoorden en tokens in.
 */
export function createRequestLogger(logger: StructuredLogger) {
  return function requestLogger(request: Request, response: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();

    response.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const user = (request as Request & { user?: { id?: string } }).user;
      const level = response.statusCode >= 500 ? 'error' : response.statusCode >= 400 ? 'warn' : 'log';

      // Gezondheidschecks loggen we niet: dat is ruis van de monitoring zelf.
      if (request.path.startsWith('/api/v1/health/') && response.statusCode < 400) return;

      logger.event(level, {
        type: 'http',
        method: request.method,
        path: request.path,
        status: response.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
        requestId: requestIdOf(request),
        ...(user?.id ? { userId: user.id } : {}),
      });
    });

    next();
  };
}
