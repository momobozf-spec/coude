import { Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JobKeyGuard } from '../compare/jobs/job-key.guard';
import { JobLeaseService, SYNC_LEASE_NAME } from '../compare/jobs/job-lease.service';
import { SyncService } from '../compare/jobs/sync.service';
import { PrismaService } from '../prisma/prisma.service';

const startedAt = Date.now();

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Gezondheid in drie lagen:
 *
 *   /health/live    — leeft het proces? Geen afhankelijkheden.
 *   /health/ready   — kan het verkeer aan? Databaseping met time-out; 503 zo niet.
 *   /health/status  — intern (jobsleutel): versie, laatste imports, alerts,
 *                     meldingen. Nooit publiek: dit beschrijft de infrastructuur.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly sync: SyncService,
    private readonly leases: JobLeaseService,
  ) {}

  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response): Promise<{ status: string; checks: Record<string, string> }> {
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, 2_000);
      return { status: 'ok', checks: { database: 'ok' } };
    } catch {
      response.status(503);
      return { status: 'unavailable', checks: { database: 'failed' } };
    }
  }

  /**
   * Opzettelijke testfout voor de foutmonitoring (`ERROR_REPORTING_DSN`):
   * alleen met jobsleutel, server-side, hoogstens 3 per minuut. De client
   * krijgt de gewone generieke 500; de monitoring hoort het event te zien.
   */
  @Post('test-error')
  @UseGuards(JobKeyGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  testError(): never {
    throw new Error(`Testfout voor foutmonitoring (${new Date().toISOString()})`);
  }

  @Get('status')
  @UseGuards(JobKeyGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async status() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 86_400_000);

    const [runs, lastAlertCheck, pendingNotifications, failedNotifications, sentNotifications, lease] = await Promise.all([
      this.prisma.importRun.findMany({ orderBy: { startedAt: 'desc' }, distinct: ['adapterKey'], take: 50 }),
      this.prisma.priceAlert.aggregate({ _max: { lastCheckedAt: true } }),
      this.prisma.alertNotification.count({ where: { status: 'PENDING' } }),
      this.prisma.alertNotification.count({ where: { status: 'FAILED', createdAt: { gte: dayAgo } } }),
      this.prisma.alertNotification.count({ where: { status: 'SENT', sentAt: { gte: dayAgo } } }),
      this.leases.current(SYNC_LEASE_NAME),
    ]);

    return {
      status: 'ok',
      version: this.config.get<string>('APP_VERSION') ?? 'dev',
      environment: this.config.get<string>('NODE_ENV') ?? 'development',
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      demoAllowed: this.config.get<boolean | undefined>('COMPARE_ALLOW_DEMO') ?? this.config.get<string>('NODE_ENV') !== 'production',
      sync: {
        runningHere: this.sync.isRunning,
        lease: lease ? { active: lease.expiresAt.getTime() > now.getTime(), expiresAt: lease.expiresAt.toISOString() } : null,
      },
      imports: runs.map((run) => ({
        adapterKey: run.adapterKey,
        status: run.status,
        source: run.source,
        termsReviewed: run.termsReviewed,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
        offersUpserted: run.offersUpserted,
        errorCount: Array.isArray(run.errors) ? run.errors.length : 0,
      })),
      alerts: { lastCheckedAt: lastAlertCheck._max.lastCheckedAt?.toISOString() ?? null },
      notifications: { pending: pendingNotifications, failedLast24h: failedNotifications, sentLast24h: sentNotifications },
    };
  }
}
