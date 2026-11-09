import { AUTH_CLIENT_HEADER } from '@superette/contracts';
import type { NextFunction, Request, Response } from 'express';
import { readCookie } from '../common/cookies';
import { requestIdOf } from '../common/request-id.middleware';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth-cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF-bescherming voor cookie-authenticatie.
 *
 * Een request die een sessiecookie meestuurt én iets wijzigt, moet:
 *   1. de header `x-superette-client` dragen — een formulier of een `<img>`
 *      kan die niet zetten, en een cross-origin `fetch` komt er zonder onze
 *      CORS-toestemming niet mee door de preflight;
 *   2. een `Origin` hebben die bij een van onze apps hoort, als de browser er
 *      een meestuurt.
 *
 * Samen met `SameSite` op de cookies zijn dat drie onafhankelijke grendels.
 * Bearer-requests (boetiek-app, tests, scanners) raken dit niet: zonder cookie
 * is er geen CSRF.
 */
export function createCsrfMiddleware(allowedOrigins: ReadonlySet<string>) {
  return function csrf(request: Request, response: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(request.method)) return next();

    const hasSessionCookie = readCookie(request, ACCESS_COOKIE) !== null || readCookie(request, REFRESH_COOKIE) !== null;
    if (!hasSessionCookie) return next();

    const client = request.header(AUTH_CLIENT_HEADER);
    const origin = request.header('origin');

    if (client !== 'web' || (origin && !allowedOrigins.has(origin))) {
      response.status(403).json({
        statusCode: 403,
        code: 'CSRF_REJECTED',
        message: 'Dit verzoek is geweigerd omdat het niet uit de Superette-app lijkt te komen.',
        requestId: requestIdOf(request),
      });
      return;
    }

    next();
  };
}
