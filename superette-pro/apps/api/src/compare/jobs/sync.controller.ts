import { Body, Controller, Get, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { z } from 'zod';
import { requestIdOf } from '../../common/request-id.middleware';
import { PrismaService } from '../../prisma/prisma.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ImportService } from '../import/import.service';
import { JobKeyGuard } from './job-key.guard';
import { SyncService, type SyncSummary } from './sync.service';

const syncBodySchema = z
  .object({ keys: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(50).default([]) })
  .default({ keys: [] });

/**
 * Interne endpoints voor de planner en voor beheer. Nooit publiek: `JobKeyGuard`
 * eist `x-job-key`, weigert browser-requests en verdwijnt (404) zonder sleutel.
 * Elke run wordt met request-id, trigger, duur en resultaat gelogd — nooit met
 * de sleutel.
 */
@Controller('compare/internal')
@UseGuards(JobKeyGuard)
export class SyncController {
  private readonly logger = new Logger('SyncAudit');

  constructor(
    private readonly sync: SyncService,
    private readonly imports: ImportService,
    private readonly prisma: PrismaService,
  ) {}

  /** Volledige synchronisatie: importeren, verlopen, alerts, meldingen. Optioneel beperkt tot `keys`. */
  @Post('sync')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async run(@Body(new ZodValidationPipe(syncBodySchema)) body: z.infer<typeof syncBodySchema>, @Req() request: Request): Promise<SyncSummary> {
    const requestId = requestIdOf(request);
    const startedAt = Date.now();
    try {
      const summary = await this.sync.runSync({ keys: body.keys, trigger: 'http', requestId });
      this.logger.log(`sync ok requestId=${requestId} durationMs=${Date.now() - startedAt} failedAdapters=${summary.failedAdapters.join(',') || '-'}`);
      return summary;
    } catch (error) {
      this.logger.warn(`sync geweigerd of mislukt requestId=${requestId} durationMs=${Date.now() - startedAt} reden=${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /** Laatste importrun per adapter, plus of er nu een synchronisatie loopt. */
  @Get('status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async status() {
    const runs = await this.prisma.importRun.findMany({ orderBy: { startedAt: 'desc' }, distinct: ['adapterKey'], take: 50 });
    const byKey = new Map(runs.map((run) => [run.adapterKey, run]));

    return {
      running: this.sync.isRunning,
      adapters: this.imports.registeredAdapters.map((adapter) => {
        const run = byKey.get(adapter.key);
        return {
          key: adapter.key,
          chain: adapter.chain.name,
          declaredSource: adapter.source.kind,
          termsReviewed: adapter.source.termsReviewed,
          lastRun: run
            ? {
                id: run.id,
                status: run.status,
                source: run.source,
                termsReviewed: run.termsReviewed,
                startedAt: run.startedAt.toISOString(),
                finishedAt: run.finishedAt?.toISOString() ?? null,
                productsSeen: run.productsSeen,
                offersUpserted: run.offersUpserted,
                offersDeactivated: run.offersDeactivated,
                historyAppended: run.historyAppended,
                matchesCreated: run.matchesCreated,
                errorCount: Array.isArray(run.errors) ? run.errors.length : 0,
                note: run.note,
              }
            : null,
        };
      }),
    };
  }
}
