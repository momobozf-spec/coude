/** Simple token-bucket style limiter: at most N calls per minute, evenly spaced. */
export function createThrottle(perMinute: number, sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): () => Promise<void> {
  const minIntervalMs = perMinute > 0 ? 60000 / perMinute : 0;
  let last = 0;
  return async () => {
    if (!minIntervalMs) return;
    const now = Date.now();
    const wait = last + minIntervalMs - now;
    if (wait > 0) await sleep(wait);
    last = Math.max(now, last + minIntervalMs);
  };
}
