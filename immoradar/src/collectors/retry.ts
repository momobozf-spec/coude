export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export function backoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number, jitter = Math.random): number {
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
  return Math.round(exp * (0.5 + jitter() * 0.5));
}

/**
 * Run `fn` with a timeout, retrying with exponential backoff. Returns the
 * value and the number of attempts used. The AbortSignal is aborted on timeout
 * so well-behaved collectors can cancel in-flight requests.
 */
export async function withRetry<T>(fn: (signal: AbortSignal) => Promise<T>, opts: RetryOptions): Promise<{ value: T; attempts: number }> {
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  let lastError: unknown;
  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new TimeoutError(opts.timeoutMs)), opts.timeoutMs);
    try {
      const value = await Promise.race([
        fn(controller.signal),
        new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(controller.signal.reason ?? new TimeoutError(opts.timeoutMs)))),
      ]);
      clearTimeout(timer);
      return { value, attempts: attempt };
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt > opts.maxRetries) break;
      const delay = backoffDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);
      opts.onRetry?.(attempt, err, delay);
      await sleep(delay);
    }
  }
  throw lastError;
}
