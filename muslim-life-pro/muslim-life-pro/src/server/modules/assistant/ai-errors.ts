import { AppError } from '@/lib/errors'
import { AiProviderError } from '@/server/integrations/ai'

/** Assistant-domain errors. SDK/HTTP detail never reaches the browser. */
export class AiError extends AppError {
  constructor(
    code:
      | 'AI_NOT_CONFIGURED'
      | 'AI_PROVIDER_UNAVAILABLE'
      | 'AI_OUTPUT_INVALID'
      | 'AI_REQUEST_REJECTED',
    message: string,
    status = 502,
  ) {
    super('PROVIDER_ERROR', message, { status, meta: { aiCode: code } })
  }
}

/** Map a provider failure onto a member-safe domain error. */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiProviderError) {
    switch (error.code) {
      case 'NOT_CONFIGURED':
        // Surfaced verbatim: this is an operator-facing misconfiguration, and
        // saying so plainly beats pretending the assistant is merely busy.
        return new AiError('AI_NOT_CONFIGURED', error.message, 503)
      case 'INVALID_OUTPUT':
        return new AiError(
          'AI_OUTPUT_INVALID',
          'The assistant produced something we could not use. Please try again.',
        )
      case 'REFUSED':
        return new AiError('AI_REQUEST_REJECTED', 'That request could not be processed.', 400)
      default:
        return new AiError(
          'AI_PROVIDER_UNAVAILABLE',
          'The assistant is temporarily unavailable. Please try again shortly.',
          503,
        )
    }
  }

  if (error instanceof AiError) return error

  return new AiError('AI_PROVIDER_UNAVAILABLE', 'The assistant is temporarily unavailable.', 503)
}
