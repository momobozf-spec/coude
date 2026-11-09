/**
 * Body-parser voor `POST /api/v1/compare/internal/feeds/:chain`.
 *
 * Een feed is groter dan de algemene grens van 64 kB (Delhaize: ±550
 * producten). Die ruimere grens krijgt alleen een verzoek dat al een geldige
 * jobsleutel draagt en geen browser-signaal heeft; elk ander verzoek valt door
 * naar de gewone parser van 64 kB. Zo kan niemand zonder sleutel de server
 * megabytes laten inlezen. `JobKeyGuard` controleert daarna alles opnieuw.
 *
 * gzip (`Content-Encoding: gzip`) wordt uitgepakt; de grens geldt voor de
 * uitgepakte inhoud.
 */
import { json, type RequestHandler } from 'express';
import { hasBrowserSignal, JOB_KEY_HEADER, matchesJobKey } from '../jobs/job-key';

export const FEED_PUSH_PATH = /^\/api\/v1\/compare\/internal\/feeds\/[^/]+\/?$/;

export function createFeedPushBodyParser(options: { jobKeys: () => readonly string[]; limitBytes: number }): RequestHandler {
  const parse = json({ limit: options.limitBytes, type: 'application/json' });

  return (request, response, next) => {
    const eligible =
      request.method === 'POST' &&
      FEED_PUSH_PATH.test(request.path) &&
      !hasBrowserSignal((name) => request.header(name)) &&
      matchesJobKey(options.jobKeys(), request.header(JOB_KEY_HEADER));

    if (!eligible) {
      next();
      return;
    }
    parse(request, response, next);
  };
}
