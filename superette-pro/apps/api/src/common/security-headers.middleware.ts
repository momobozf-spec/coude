import type { NextFunction, Request, Response } from 'express';

export interface SecurityHeadersOptions {
  /** HSTS alleen zetten als de API via HTTPS wordt aangeboden (achter de proxy). */
  readonly hsts: boolean;
}

/**
 * Beveiligingsheaders voor API-antwoorden.
 *
 * De API levert JSON, geen pagina's; de CSP verbiedt daarom alles en verbiedt
 * inbedding. Privéantwoorden mogen nergens gecachet worden.
 */
export function createSecurityHeaders(options: SecurityHeadersOptions) {
  return function securityHeaders(request: Request, response: Response, next: NextFunction): void {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    if (options.hsts) response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    const authenticated = !!request.headers.authorization || !!request.headers.cookie;
    response.setHeader('Cache-Control', authenticated || request.method !== 'GET' ? 'no-store' : 'private, no-cache');

    next();
  };
}
