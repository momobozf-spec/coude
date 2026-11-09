import type { EmailDraft } from '../../domain/admin';
import type { Briefing, DeliveryStatus, NotificationChannel } from '../../domain/ops';
import type { EmailProvider } from '../../email/EmailProvider';

/**
 * BriefingDeliveryProvider (§157). In-app delivery is built into the BriefingService
 * (a stored notification). Email delivery only reports "delivered" when the configured
 * EmailProvider actually sent; push delivery lives on the server (Expo push API).
 */
export interface BriefingDeliveryProvider {
  readonly channel: NotificationChannel;
  isAvailable(): Promise<boolean>;
  deliver(briefing: Briefing): Promise<{ status: DeliveryStatus; detail: string | null }>;
}

export class EmailBriefingDelivery implements BriefingDeliveryProvider {
  readonly channel = 'email' as const;

  constructor(
    private readonly provider: () => EmailProvider,
    private readonly recipient: () => Promise<string | null>,
    private readonly now: () => string,
  ) {}

  async isAvailable(): Promise<boolean> {
    const provider = this.provider();
    if (!provider.capabilities().canSend) return false;
    const status = await provider.status().catch(() => null);
    return status?.state === 'ready' && Boolean(await this.recipient());
  }

  async deliver(briefing: Briefing): Promise<{ status: DeliveryStatus; detail: string | null }> {
    const to = await this.recipient();
    if (!to) return { status: 'skipped', detail: 'no recipient address in the business profile' };
    const provider = this.provider();
    if (!provider.capabilities().canSend) return { status: 'skipped', detail: `${provider.id} cannot send` };
    const draft: EmailDraft = { id: `briefing-${briefing.id}`, replyToEmailId: null, to: [{ name: null, email: to }], subject: `${briefing.kind === 'morning' ? 'Morning briefing' : briefing.kind === 'evening' ? 'Evening review' : 'Night shift report'} ${briefing.date}`, body: briefing.text, style: null, instruction: null, version: 1, status: 'draft', sentAt: null, createdAt: this.now(), updatedAt: this.now() };
    const result = await provider.send(draft, { inReplyToExternalId: null });
    return { status: 'delivered', detail: result.externalId ? `sent as ${result.externalId}` : 'sent' };
  }
}
