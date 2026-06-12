const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;

export function rateLimit(identifier: string): { success: boolean } {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || now - entry.lastReset > WINDOW_MS) {
    rateLimitMap.set(identifier, { count: 1, lastReset: now });
    return { success: true };
  }

  if (entry.count >= MAX_REQUESTS) {
    return { success: false };
  }

  entry.count++;
  return { success: true };
}
