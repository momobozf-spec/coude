/**
 * Achtergrondwerker voor de supermarktvergelijker: synchroniseert elke
 * `COMPARE_SYNC_INTERVAL_MINUTES` (standaard 60) en sluit netjes af op
 * SIGTERM — een lopende run wordt afgemaakt, de lease vrijgegeven.
 *
 *   node dist/compare/cli/worker.cli.js
 *
 * Meerdere werkers (of een werker naast de API-planner) bijten elkaar niet:
 * de databaselease (`JobLease`) laat één synchronisatie tegelijk toe; wie
 * geen lease krijgt, slaat de beurt over en probeert de volgende keer opnieuw.
 * Eén run per aanroep (cron) kan ook: zie `sync.cli.ts`.
 */
import 'reflect-metadata';
import { ConflictException, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CompareStandaloneModule } from '../compare-standalone.module';
import { SyncService } from '../jobs/sync.service';

const logger = new Logger('Worker');

function intervalMs(): number {
  const minutes = Number(process.env['COMPARE_SYNC_INTERVAL_MINUTES'] ?? 60);
  return Math.max(1, Number.isFinite(minutes) && minutes > 0 ? minutes : 60) * 60_000;
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(CompareStandaloneModule, { logger: ['error', 'warn', 'log'] });
  const sync = app.get(SyncService);
  const interval = intervalMs();

  let stopping = false;
  let running: Promise<void> | null = null;
  let timer: NodeJS.Timeout | null = null;
  let wake: (() => void) | null = null;

  const stop = async (signal: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    logger.log(`${signal} ontvangen — wacht op de lopende synchronisatie en sluit af`);
    if (timer) clearTimeout(timer);
    wake?.();
    await running;
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop('SIGTERM'));
  process.on('SIGINT', () => void stop('SIGINT'));

  logger.log(`werker gestart: elke ${interval / 60_000} min een synchronisatie`);

  while (!stopping) {
    running = sync
      .runSync({ trigger: 'worker' })
      .then((summary) => {
        logger.log(`synchronisatie klaar runId=${summary.runId} durationMs=${summary.durationMs} failedAdapters=${summary.failedAdapters.join(',') || '-'}`);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        // Een andere instantie houdt de lease: geen fout, gewoon de beurt overslaan.
        // (Gevonden op staging: als `error` gelogd zou dit de foutmonitoring vullen.)
        const leaseHeldElsewhere = error instanceof ConflictException || /SYNC_ALREADY_RUNNING|loopt al een synchronisatie/i.test(message);
        if (leaseHeldElsewhere) logger.log(`synchronisatie overgeslagen: ${message}`);
        else logger.error(`synchronisatie mislukt: ${message}`);
      });
    await running;
    running = null;
    if (stopping) break;

    await new Promise<void>((resolve) => {
      wake = resolve;
      timer = setTimeout(resolve, interval);
    });
  }
}

main().catch((error) => {
  logger.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
