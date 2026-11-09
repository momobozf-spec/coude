import type { NestExpressApplication } from '@nestjs/platform-express';
import { createFeedPushBodyParser } from '../compare/feeds/feed-push-body-parser';

/**
 * Body's parsen we zelf, met expliciete limieten: niemand hoeft ons megabytes
 * JSON te sturen. Uitzondering: een feed-push met geldige jobsleutel (zie
 * `feed-push-body-parser.ts`). De Mollie-webhook praat urlencoded.
 * Volgorde telt: de feed-parser eerst; een al gelezen body slaat de rest over.
 */
export function configureBodyParsers(app: NestExpressApplication, options: { jobKeys: () => readonly string[]; feedPushMaxBytes: number }): void {
  app.use(createFeedPushBodyParser({ jobKeys: options.jobKeys, limitBytes: options.feedPushMaxBytes }));
  app.useBodyParser('json', { limit: '64kb' });
  app.useBodyParser('urlencoded', { extended: false, limit: '16kb' });
}
