import type { Database } from '../../src/core/db/Database';
import type { DeliveryStatus, OpsNotification } from '../../src/core/domain/ops';
import type { NotificationSink } from '../../src/core/ops/services/NotificationService';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Push delivery through Expo's push service (§169). Only tokens the app registered are
 * used; "delivered" means Expo accepted the message (a ticket with status ok), not that
 * the phone displayed it – that part REQUIRES DEVICE TEST.
 */
export class ExpoPushSink implements NotificationSink {
  readonly channel = 'push' as const;

  constructor(
    private readonly db: Database,
    private readonly fetchImpl: typeof fetch = globalThis.fetch,
  ) {}

  async isAvailable(): Promise<boolean> {
    return (await this.db.pushTokens.list()).length > 0;
  }

  async deliver(notification: OpsNotification): Promise<{ status: DeliveryStatus; detail: string | null }> {
    const tokens = await this.db.pushTokens.list();
    if (!tokens.length) return { status: 'skipped', detail: 'no push tokens registered' };
    const messages = tokens.map((t) => ({ to: t.token, title: notification.title, body: notification.body.slice(0, 500), data: notification.data, sound: 'default' }));
    const response = await this.fetchImpl(EXPO_PUSH_URL, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(messages) });
    const json = (await response.json().catch(() => null)) as { data?: PushTicket[]; errors?: { message?: string }[] } | null;
    if (!response.ok || !json) return { status: 'failed', detail: `Expo push HTTP ${response.status}` };
    const tickets = json.data ?? [];
    for (const [index, ticket] of tickets.entries()) {
      const token = tokens[index]?.token;
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' && token) await this.db.pushTokens.remove(token);
    }
    const ok = tickets.filter((t) => t.status === 'ok').length;
    if (ok === 0) return { status: 'failed', detail: tickets.map((t) => t.message ?? t.details?.error ?? 'error').join('; ') || json.errors?.map((e) => e.message).join('; ') || 'no ticket accepted' };
    return { status: 'delivered', detail: `accepted by Expo for ${ok}/${tokens.length} device(s)` };
  }
}
