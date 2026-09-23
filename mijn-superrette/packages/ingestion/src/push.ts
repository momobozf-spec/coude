/** Push delivery abstraction. Mobile clients register Expo push tokens. */
export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushResult {
  /** Tickets accepted by the push service (not a delivery guarantee). */
  ticketIds: string[];
  /** Tokens the service reported as no longer registered: disable them. */
  invalidTokens: string[];
  errors: string[];
}

export interface PushSender {
  send(messages: PushMessage[]): Promise<PushResult>;
}

/** Development sender: logs instead of delivering. */
export class LogPushSender implements PushSender {
  readonly sent: PushMessage[] = [];
  constructor(private readonly log: (msg: string) => void = () => {}) {}
  async send(messages: PushMessage[]): Promise<PushResult> {
    this.sent.push(...messages);
    for (const m of messages) this.log(`[push] ${m.to}: ${m.title} — ${m.body}`);
    return { ticketIds: messages.map((_, i) => `log-${Date.now()}-${i}`), invalidTokens: [], errors: [] };
  }
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Expo Push Service sender (https://docs.expo.dev/push-notifications/sending-notifications/).
 * Batches of max 100 messages; an access token is optional unless enhanced
 * push security is enabled for the project (read from env, never committed).
 */
export class ExpoPushSender implements PushSender {
  private readonly endpoint: string;
  constructor(private readonly options: { accessToken?: string | null; fetch?: typeof fetch; endpoint?: string } = {}) {
    this.endpoint = options.endpoint ?? 'https://exp.host/--/api/v2/push/send';
  }

  async send(messages: PushMessage[]): Promise<PushResult> {
    const result: PushResult = { ticketIds: [], invalidTokens: [], errors: [] };
    const doFetch = this.options.fetch ?? fetch;
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100).map((m) => ({
        to: m.to,
        title: m.title,
        body: m.body,
        data: m.data ?? {},
        sound: 'default',
        priority: 'high',
        channelId: 'price-alerts',
      }));
      const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (this.options.accessToken) headers.Authorization = `Bearer ${this.options.accessToken}`;
      try {
        const res = await doFetch(this.endpoint, { method: 'POST', headers, body: JSON.stringify(batch) });
        if (!res.ok) {
          result.errors.push(`Expo push HTTP ${res.status}`);
          continue;
        }
        const body = (await res.json()) as { data?: ExpoTicket[] };
        (body.data ?? []).forEach((ticket, index) => {
          if (ticket.status === 'ok' && ticket.id) result.ticketIds.push(ticket.id);
          else if (ticket.details?.error === 'DeviceNotRegistered') result.invalidTokens.push(batch[index]!.to);
          else result.errors.push(ticket.message ?? 'unknown push error');
        });
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    return result;
  }
}
