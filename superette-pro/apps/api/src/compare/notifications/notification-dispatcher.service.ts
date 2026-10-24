/**
 * Verstuurt klaarstaande meldingen, idempotent en in overzichten.
 *
 *  - groepeert `PENDING`-rijen per (gebruiker, kanaal, dag) → één overzicht;
 *  - markeert alle rijen van het overzicht in één keer als SENT / FAILED / SKIPPED;
 *  - probeert een mislukte rij hoogstens `MAX_ATTEMPTS` keer;
 *  - raakt nooit een rij aan die al SENT is — een retry maakt geen tweede melding.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AlertNotification } from '@superette/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { NOTIFICATION_CHANNELS, type NotificationChannelAdapter, type NotificationDigest } from './notification-channel';

export interface DispatchSummary {
  readonly sent: number;
  readonly failed: number;
  readonly skipped: number;
  readonly digests: number;
}

const MAX_ATTEMPTS = 3;
const BATCH_LIMIT = 500;

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_CHANNELS) private readonly channels: readonly NotificationChannelAdapter[],
  ) {}

  async dispatchPending(now: Date = new Date()): Promise<DispatchSummary> {
    const pending = await this.prisma.alertNotification.findMany({
      where: { status: 'PENDING', attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { createdAt: 'asc' },
      take: BATCH_LIMIT,
    });

    const groups = new Map<string, typeof pending>();
    for (const row of pending) {
      const key = `${row.userId}|${row.channel}|${row.digestKey}`;
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }

    const summary = { sent: 0, failed: 0, skipped: 0, digests: 0 };

    for (const rows of groups.values()) {
      const first = rows[0]!;
      const adapter = this.channels.find((channel) => channel.channel === first.channel);
      const ids = rows.map((row) => row.id);
      summary.digests++;

      if (!adapter) {
        await this.prisma.alertNotification.updateMany({
          where: { id: { in: ids } },
          data: { status: 'SKIPPED', attempts: { increment: 1 }, errorMessage: `Geen kanaal voor ${first.channel}` },
        });
        summary.skipped += rows.length;
        continue;
      }

      const digest: NotificationDigest = {
        userId: first.userId,
        channel: first.channel,
        digestKey: first.digestKey,
        notifications: rows.map((row) => row.payload as unknown as AlertNotification),
      };

      try {
        const result = await adapter.deliver(digest);

        if (result.status === 'SENT') {
          await this.prisma.alertNotification.updateMany({
            where: { id: { in: ids }, status: 'PENDING' },
            data: { status: 'SENT', sentAt: now, attempts: { increment: 1 }, errorMessage: null },
          });
          summary.sent += rows.length;
        } else if (result.status === 'SKIPPED') {
          await this.prisma.alertNotification.updateMany({
            where: { id: { in: ids }, status: 'PENDING' },
            data: { status: 'SKIPPED', attempts: { increment: 1 }, errorMessage: result.reason },
          });
          summary.skipped += rows.length;
        } else {
          await this.markFailed(ids, result.error, result.permanent === true);
          summary.failed += rows.length;
        }
      } catch (error) {
        // Een kanaal dat werpt, is een provider-fout: registreren en later opnieuw proberen.
        await this.markFailed(ids, error instanceof Error ? error.message.slice(0, 300) : 'Onbekende fout');
        summary.failed += rows.length;
      }
    }

    if (summary.digests > 0) {
      this.logger.log(`Meldingen: ${summary.sent} verstuurd, ${summary.failed} mislukt, ${summary.skipped} overgeslagen (${summary.digests} overzichten)`);
    }

    return summary;
  }

  /** Mislukt: blijft PENDING tot het maximum aantal pogingen, daarna FAILED. Permanent = meteen FAILED. */
  private async markFailed(ids: string[], error: string, permanent = false): Promise<void> {
    await this.prisma.alertNotification.updateMany({
      where: { id: { in: ids }, status: 'PENDING' },
      data: { attempts: { increment: 1 }, errorMessage: error },
    });
    await this.prisma.alertNotification.updateMany({
      where: { id: { in: ids }, status: 'PENDING', ...(permanent ? {} : { attempts: { gte: MAX_ATTEMPTS } }) },
      data: { status: 'FAILED' },
    });
  }
}
