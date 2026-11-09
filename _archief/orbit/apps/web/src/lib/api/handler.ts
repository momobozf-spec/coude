import { NextResponse, type NextRequest } from 'next/server';
import { RATE_LIMITS, rateLimitKey, type RateLimitName } from '@orbit/auth';
import { DomainError, toDomainError, type Scope } from '@orbit/db';
import { authenticate, createScope } from '@orbit/api-core';
import { ErrorCode, HTTP_STATUS_BY_ERROR, type ApiErrorBody } from '@orbit/types';
import { ulid } from '@orbit/utils';
import { ZodError, type ZodTypeAny, type output } from 'zod';
import { ACCESS_COOKIE, WORKSPACE_COOKIE } from './cookies';
import { authSecret, prisma, rateLimiter } from './runtime';

/**
 * Eén doorgeefluik voor alle route handlers.
 *
 * Elke route krijgt hierdoor automatisch: rate limiting, authenticatie,
 * workspace-scoping, schemavalidatie en een uniforme foutvorm. Een route die
 * een van die stappen vergeet kan simpelweg niet bestaan.
 */

export interface HandlerContext<TBody> {
  request: NextRequest;
  scope: Scope;
  body: TBody;
  params: Record<string, string>;
  requestId: string;
}

/**
 * De body komt uit het *output*-type van het schema, niet uit het input-type.
 * Dat verschil is niet cosmetisch: bij een veld met `.default()` is de waarde
 * na parsen gegarandeerd aanwezig, en zonder dit onderscheid zou elke handler
 * die zekerheid weer moeten weggooien.
 */
type BodyOf<S> = S extends ZodTypeAny ? output<S> : undefined;

interface RouteOptions<S extends ZodTypeAny | undefined> {
  /** Zonder schema krijgt de handler `undefined` als body. */
  schema?: S;
  limit?: RateLimitName;
  /** Hoeveel tokens deze aanroep kost; sync-batches wegen zwaarder. */
  cost?: number;
}

function errorResponse(
  code: ErrorCode,
  message: string,
  requestId: string,
  extra: Partial<ApiErrorBody['error']> = {},
): NextResponse {
  const body: ApiErrorBody = { error: { code, message, requestId, ...extra } };
  return NextResponse.json(body, { status: HTTP_STATUS_BY_ERROR[code] });
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

/** Bearer-token van de mobiele app, of anders de httpOnly-cookie van de webapp. */
function authorizationFor(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (header) return header;
  const cookie = request.cookies.get(ACCESS_COOKIE)?.value;
  return cookie ? `Bearer ${cookie}` : null;
}

async function parseBody<S extends ZodTypeAny | undefined>(
  request: NextRequest,
  schema: S | undefined,
): Promise<BodyOf<S>> {
  if (!schema) return undefined as BodyOf<S>;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new DomainError(ErrorCode.ValidationFailed, 'Verwacht een JSON-body');
  }
  return schema.parse(raw) as BodyOf<S>;
}

function toErrorResponse(error: unknown, requestId: string): NextResponse {
  if (error instanceof ZodError) {
    return errorResponse(ErrorCode.ValidationFailed, 'Ongeldige invoer', requestId, {
      fields: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  const domainError = toDomainError(error);
  if (domainError.code === ErrorCode.Internal) {
    // De echte oorzaak alleen in de serverlogs; naar buiten toe niets dat het
    // schema of de stacktrace verraadt.
    console.error(`[${requestId}]`, error);
    return errorResponse(ErrorCode.Internal, 'Er ging iets mis', requestId);
  }
  return errorResponse(domainError.code, domainError.message, requestId, {
    ...(domainError.fields ? { fields: domainError.fields } : {}),
  });
}

/** Route die inloggen vereist. */
export function withAuth<S extends ZodTypeAny | undefined = undefined>(
  options: RouteOptions<S>,
  handler: (context: HandlerContext<BodyOf<S>>) => Promise<NextResponse | unknown>,
) {
  return async (
    request: NextRequest,
    // Next 15 eist dat het tweede argument verplicht is en `params` als promise
    // levert; een optionele parameter laat de gegenereerde route-typen falen.
    routeContext: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const requestId = ulid();

    try {
      const user = await authenticate(
        { authorizationHeader: authorizationFor(request) },
        authSecret(),
      );

      const limitName = options.limit ?? 'read';
      const limit = await rateLimiter().consume(
        rateLimitKey(limitName, { userId: user.userId }),
        RATE_LIMITS[limitName],
        options.cost ?? 1,
      );
      if (!limit.allowed) {
        return errorResponse(ErrorCode.RateLimited, 'Te veel verzoeken', requestId, {
          retryAfter: limit.retryAfterSeconds,
        });
      }

      const scope = await createScope({
        db: prisma(),
        user,
        requestedWorkspaceId:
          request.headers.get('x-workspace-id') ?? request.cookies.get(WORKSPACE_COOKIE)?.value,
        deviceId: request.headers.get('x-device-id'),
      });

      const body = await parseBody<S>(request, options.schema);
      const params = (await routeContext?.params) ?? {};
      const result = await handler({ request, scope, body, params, requestId });

      return result instanceof NextResponse ? result : NextResponse.json(result ?? {});
    } catch (error) {
      return toErrorResponse(error, requestId);
    }
  };
}

/** Route zonder sessie (registreren, inloggen, token verversen). */
export function withPublic<S extends ZodTypeAny | undefined = undefined>(
  options: RouteOptions<S>,
  handler: (context: Omit<HandlerContext<BodyOf<S>>, 'scope'>) => Promise<NextResponse | unknown>,
) {
  return async (
    request: NextRequest,
    // Next 15 eist dat het tweede argument verplicht is en `params` als promise
    // levert; een optionele parameter laat de gegenereerde route-typen falen.
    routeContext: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const requestId = ulid();

    try {
      const limitName = options.limit ?? 'read';
      const limit = await rateLimiter().consume(
        // Zonder sessie is het ip het enige aanknopingspunt; daarom staan de
        // limieten voor inloggen en registreren bewust laag.
        rateLimitKey(limitName, { ip: clientIp(request) }),
        RATE_LIMITS[limitName],
        options.cost ?? 1,
      );
      if (!limit.allowed) {
        return errorResponse(ErrorCode.RateLimited, 'Te veel pogingen', requestId, {
          retryAfter: limit.retryAfterSeconds,
        });
      }

      const body = await parseBody<S>(request, options.schema);
      const params = (await routeContext?.params) ?? {};
      const result = await handler({ request, body, params, requestId });

      return result instanceof NextResponse ? result : NextResponse.json(result ?? {});
    } catch (error) {
      return toErrorResponse(error, requestId);
    }
  };
}

export { errorResponse, clientIp };
