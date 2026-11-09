/**
 * Eén foutafhandeling voor alle route handlers.
 *
 * Zonder dit krijgt elke route zijn eigen try/catch, en dan is het een kwestie
 * van tijd tot er één een Prisma-fout ongefilterd doorgeeft — inclusief
 * tabelnamen, kolomnamen en soms de waarden uit de query.
 *
 * De regel: een `AppError` bevat een boodschap die voor de gebruiker bedoeld is
 * en gaat door. Al het andere is onverwacht en wordt een generieke 500, met de
 * details alleen in de log.
 */
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { AppError, isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown }
}

export function toApiError(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'De invoer klopt niet.',
          // Alleen pad en boodschap; niet de ingestuurde waarden — die kunnen
          // een wachtwoord of documentinhoud bevatten.
          details: error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
      },
      { status: 400 },
    )
  }

  if (isAppError(error)) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    )
  }

  logger.error('Onverwachte fout in een API-route', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  })

  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Er ging iets mis. Probeer het opnieuw.' } },
    { status: 500 },
  )
}

/** Wikkelt een handler zodat elke fout door `toApiError` gaat. */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args)
    } catch (error) {
      return toApiError(error)
    }
  }
}

export { AppError }
