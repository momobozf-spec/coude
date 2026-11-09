import { createHash, timingSafeEqual } from 'node:crypto';

/** Header waarin servers (cron, `npm run feeds:push`) de jobsleutel meesturen. */
export const JOB_KEY_HEADER = 'x-job-key';

const digest = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

/**
 * Vergelijkt een aangeboden sleutel met de huidige (en tijdens een rotatie de
 * vorige) jobsleutel, in constante tijd: beide kanten worden eerst SHA-256,
 * zodat ook de lengte niets verraadt. Alle sleutels worden altijd vergeleken.
 */
export function matchesJobKey(keys: readonly string[], presented: unknown): boolean {
  if (typeof presented !== 'string' || presented.length === 0 || keys.length === 0) return false;
  const presentedDigest = digest(presented);
  let valid = false;
  for (const key of keys) {
    if (timingSafeEqual(presentedDigest, digest(key))) valid = true;
  }
  return valid;
}

/** Een browser stuurt bij elke cross-site request `Origin` of `Sec-Fetch-Site`; een cron of server nooit. */
export function hasBrowserSignal(header: (name: string) => string | undefined): boolean {
  return !!(header('origin') || header('sec-fetch-site'));
}
