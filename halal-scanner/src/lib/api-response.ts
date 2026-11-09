import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, describeError, isAppError } from "./errors";
import { logger, newRequestId, type Logger, type LogContext } from "./logger";

/**
 * Eén responsevorm voor alle endpoints.
 *
 *   success  -> { data: ..., meta: { requestId, ... } }
 *   failure  -> { error: { code, message, requestId, details? } }
 *
 * De client hoeft dus nooit op HTTP-status alleen te vertrouwen, en elke fout
 * is via `requestId` terug te vinden in de logs.
 */

export interface ApiMeta {
  requestId: string;
  [key: string]: unknown;
}

export interface ApiSuccess<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
}

/** Wat een handler teruggeeft; `handleRoute` maakt er de HTTP-respons van. */
export interface RouteResult<T> {
  data: T;
  meta?: Record<string, unknown>;
  status?: number;
  headers?: Record<string, string>;
}

export interface RouteContext {
  requestId: string;
  log: Logger;
}

function failureResponse(error: AppError, requestId: string): NextResponse<ApiFailure> {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        requestId,
        ...(error.details ? { details: error.details } : {}),
      },
    },
    { status: error.status },
  );
}

/**
 * Wikkelt een route handler.
 *
 * Zorgt voor: een requestId per aanroep, vertaling van AppError/ZodError naar
 * de juiste HTTP-status, en - belangrijk - dat een onverwachte fout nooit een
 * stacktrace of interne boodschap naar de client lekt. Die gaat naar de log; de
 * client krijgt alleen een generieke boodschap plus het requestId.
 */
export async function handleRoute<T>(
  route: string,
  handler: (ctx: RouteContext) => Promise<RouteResult<T>>,
): Promise<NextResponse<ApiSuccess<T> | ApiFailure>> {
  const requestId = newRequestId();
  const log = logger.child({ requestId, route });

  try {
    const result = await handler({ requestId, log });
    return NextResponse.json(
      { data: result.data, meta: { ...result.meta, requestId } },
      { status: result.status ?? 200, headers: result.headers },
    );
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return failureResponse(
        new AppError("VALIDATION_ERROR", "De opgegeven parameters zijn ongeldig.", {
          details: {
            issues: error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        }),
        requestId,
      );
    }

    if (isAppError(error)) {
      const context: LogContext = { code: error.code, status: error.status };
      // Verwachte 4xx zijn geen incidenten; alleen 5xx als error loggen.
      if (error.status >= 500) log.error("REQUEST_FAILED", context);
      else log.info("REQUEST_FAILED", context);
      return failureResponse(error, requestId);
    }

    log.error("REQUEST_FAILED", describeError(error));
    return failureResponse(
      new AppError("INTERNAL_ERROR", "Er is een onverwachte fout opgetreden."),
      requestId,
    );
  }
}
