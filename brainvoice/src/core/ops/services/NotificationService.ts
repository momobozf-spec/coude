import type { Database } from '../../db/Database';
import type { DeliveryStatus, NotificationChannel, OpsNotification } from '../../domain/ops';
import type { Logger } from '../../logging/logger';
import type { Clock } from '../../services/Clock';
import { newId } from '../../util/id';

/** A delivery channel (push, email). In-app delivery is the database row itself. */
export interface NotificationSink {
  readonly channel: NotificationChannel;
  isAvailable(): Promise<boolean>;
  deliver(notification: OpsNotification): Promise<{ status: DeliveryStatus; detail: string | null }>;
}

export interface NotifyInput {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Default: in_app plus every configured sink. */
  channels?: NotificationChannel[];
}

/**
 * Notifications (§169): every message is stored (the Mission Control feed) and, when a
 * sink exists, delivered through it. Failures are recorded truthfully; nothing is
 * reported as "sent" without a sink confirming it.
 */
export class NotificationService {
  private readonly sinks: NotificationSink[] = [];

  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly logger?: Logger,
  ) {}

  addSink(sink: NotificationSink): void {
    this.sinks.push(sink);
  }

  channels(): NotificationChannel[] {
    return ['in_app', ...this.sinks.map((s) => s.channel).filter((c) => c !== 'in_app')];
  }

  async notify(input: NotifyInput): Promise<OpsNotification[]> {
    const nowISO = this.clock.nowISO();
    const channels = input.channels?.length ? input.channels : this.channels();
    const out: OpsNotification[] = [];
    for (const channel of channels) {
      const notification: OpsNotification = { id: newId(), title: input.title, body: input.body, channel, status: 'pending', detail: null, data: input.data ?? {}, readAt: null, createdAt: nowISO, deliveredAt: null };
      await this.db.opsNotifications.insert(notification);
      if (channel === 'in_app') {
        await this.db.opsNotifications.setStatus(notification.id, 'delivered', null, nowISO);
        out.push({ ...notification, status: 'delivered', deliveredAt: nowISO });
        continue;
      }
      const sink = this.sinks.find((s) => s.channel === channel);
      if (!sink || !(await sink.isAvailable().catch(() => false))) {
        await this.db.opsNotifications.setStatus(notification.id, 'skipped', 'no delivery provider configured', null);
        out.push({ ...notification, status: 'skipped', detail: 'no delivery provider configured' });
        continue;
      }
      try {
        const result = await sink.deliver(notification);
        await this.db.opsNotifications.setStatus(notification.id, result.status, result.detail, result.status === 'delivered' ? this.clock.nowISO() : null);
        out.push({ ...notification, status: result.status, detail: result.detail });
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        await this.db.opsNotifications.setStatus(notification.id, 'failed', detail, null);
        this.logger?.warn('notification delivery failed', { channel, detail });
        out.push({ ...notification, status: 'failed', detail });
      }
    }
    return out;
  }

  list(limit = 50): Promise<OpsNotification[]> {
    return this.db.opsNotifications.listRecent(limit);
  }

  unreadCount(): Promise<number> {
    return this.db.opsNotifications.countUnread();
  }

  markRead(id: string): Promise<void> {
    return this.db.opsNotifications.markRead(id, this.clock.nowISO());
  }

  markAllRead(): Promise<void> {
    return this.db.opsNotifications.markAllRead(this.clock.nowISO());
  }
}
