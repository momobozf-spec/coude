import { AiProviderError } from '@/server/integrations/ai/types'

/**
 * Shared HTTP plumbing for the real providers.
 *
 * Both adapters talk to the vendors' REST APIs directly rather than through an
 * SDK. That keeps the dependency tree free of two large packages that would
 * otherwise be installed whether or not anyone configures a key, and it removes
 * any chance of a vendor SDK reaching a client bundle. The request shapes used
 * here are small and stable.
 */

export const DEFAULT_TIMEOUT_MS = 60_000

/** Map an HTTP status onto a typed, correctly-retryable error. */
export function errorForStatus(status: number, body: string): AiProviderError {
  if (status === 401 || status === 403) {
    return new AiProviderError('NOT_CONFIGURED', 'The AI provider rejected our credentials.', {
      retryable: false,
      status,
    })
  }

  if (status === 429) {
    return new AiProviderError('RATE_LIMITED', 'The AI provider is rate limiting us.', {
      retryable: true,
      status,
    })
  }

  if (status >= 500) {
    return new AiProviderError('UNAVAILABLE', 'The AI provider is unavailable.', {
      retryable: true,
      status,
    })
  }

  // 4xx other than the above means we sent something wrong. Retrying an
  // identical bad request just spends money to fail again.
  return new AiProviderError('REFUSED', `The AI provider rejected the request (${status}).`, {
    retryable: false,
    status,
    cause: body.slice(0, 500),
  })
}

export interface PostOptions {
  url: string
  headers: Record<string, string>
  body: unknown
  signal?: AbortSignal
  timeoutMs?: number
}

/** Timed POST. Composes the caller's signal with our own timeout. */
export async function postJson({
  url,
  headers,
  body,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: PostOptions): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw errorForStatus(response.status, await response.text().catch(() => ''))
    }

    return response
  } catch (error) {
    if (error instanceof AiProviderError) throw error

    if (error instanceof Error && error.name === 'AbortError') {
      // A caller-initiated cancel is not a timeout, and must not be retried.
      if (signal?.aborted) {
        throw new AiProviderError('UNAVAILABLE', 'Request was cancelled.', { retryable: false })
      }
      throw new AiProviderError('TIMEOUT', 'The AI provider did not respond in time.', {
        retryable: true,
      })
    }

    throw new AiProviderError('UNAVAILABLE', 'Could not reach the AI provider.', {
      retryable: true,
      cause: error,
    })
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Parse a server-sent-event stream into `data:` payloads.
 *
 * Buffers across chunk boundaries, because a JSON payload is regularly split
 * mid-object by the transport.
 */
export async function* parseSseStream(response: Response): AsyncIterable<unknown> {
  const body = response.body
  if (!body) {
    throw new AiProviderError('UNAVAILABLE', 'The AI provider returned an empty stream.')
  }

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Events are separated by a blank line.
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const rawEvent = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)

        for (const line of rawEvent.split('\n')) {
          if (!line.startsWith('data:')) continue

          const payload = line.slice(5).trim()
          if (payload.length === 0 || payload === '[DONE]') continue

          try {
            yield JSON.parse(payload)
          } catch {
            // A malformed frame is skipped rather than killing the whole stream.
          }
        }

        boundary = buffer.indexOf('\n\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Retry with exponential backoff, for transient failures only.
 *
 * Never retries a refusal or an invalid-output error: those are deterministic,
 * and re-rolling a refused request is how a guardrail gets sampled past.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  { attempts = 3, baseDelayMs = 400 }: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      const retryable = error instanceof AiProviderError && error.retryable
      if (!retryable || attempt === attempts - 1) throw error

      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt))
    }
  }

  throw lastError
}
