import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { AppError, EntitlementError, RateLimitError, ValidationError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { isProduction } from '@/config/env'

/**
 * One place that turns a thrown error into an HTTP response, so no route handler
 * invents its own error shape and no unexpected exception leaks a stack trace or
 * a database message to the client.
 */

export interface ErrorBody {
  error: {
    code: string
    message: string
    issues?: Record<string, string[]>
    feature?: string | null
    requiredPlan?: string | null
  }
}

const NO_STORE = { 'Cache-Control': 'no-store' } as const

export function ok<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, { ...init, headers: { ...NO_STORE, ...init?.headers } })
}

export function created<T>(data: T): NextResponse<T> {
  return ok(data, { status: 201 })
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: NO_STORE })
}

function zodIssues(error: ZodError): Record<string, string[]> {
  const issues: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    ;(issues[key] ??= []).push(issue.message)
  }
  return issues
}

export function failure(error: unknown): NextResponse<ErrorBody> {
  if (error instanceof ZodError) {
    return errorResponse(422, {
      code: 'VALIDATION_ERROR',
      message: 'De ingevoerde gegevens kloppen niet.',
      issues: zodIssues(error),
    })
  }

  if (error instanceof ValidationError) {
    return errorResponse(error.status, {
      code: error.code,
      message: error.message,
      issues: error.issues,
    })
  }

  if (error instanceof EntitlementError) {
    return errorResponse(error.status, {
      code: error.code,
      message: error.message,
      feature: error.feature,
      requiredPlan: error.requiredPlan,
    })
  }

  if (error instanceof RateLimitError) {
    return NextResponse.json<ErrorBody>(
      { error: { code: error.code, message: error.message } },
      {
        status: error.status,
        headers: { ...NO_STORE, 'Retry-After': String(error.retryAfterSeconds) },
      },
    )
  }

  if (error instanceof AppError) {
    return errorResponse(error.status, { code: error.code, message: error.message })
  }

  // Anything else is a bug. Log the detail, tell the client nothing.
  logger.error('http.unhandled_error', {
    message: error instanceof Error ? error.message : String(error),
    stack: isProduction ? undefined : (error instanceof Error ? error.stack : undefined),
  })

  return errorResponse(500, {
    code: 'INTERNAL_ERROR',
    message: 'Er ging iets mis. Probeer het later opnieuw.',
  })
}

function errorResponse(status: number, body: ErrorBody['error']): NextResponse<ErrorBody> {
  return NextResponse.json<ErrorBody>({ error: body }, { status, headers: NO_STORE })
}

/** Wrap a route handler so every throw becomes a well-formed response. */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await fn(...args)
    } catch (error) {
      return failure(error)
    }
  }
}
