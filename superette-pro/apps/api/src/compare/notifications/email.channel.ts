import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CompareConfig } from '../compare-config';
import { buildDigestEmail } from './email/email-templates';
import { EMAIL_TRANSPORT, type EmailTransport } from './email/email-transport';
import type { DeliveryResult, NotificationChannelAdapter, NotificationDigest } from './notification-channel';

/**
 * E-mailkanaal.
 *
 * Verstuurt één overzicht per gebruiker per dag, en alleen als:
 *  1. e-mail aanstaat (`NOTIFY_EMAIL_ENABLED`) én er een echt transport is;
 *  2. de gebruiker e-mailmeldingen heeft aangezet (opt-in in de voorkeuren);
 *  3. het account actief is.
 *
 * Anders wordt de melding eerlijk overgeslagen met een reden; in-app blijft
 * ze gewoon zichtbaar. We doen nooit alsof er iets verstuurd is.
 * Het e-mailadres wordt niet gelogd.
 */
@Injectable()
export class EmailChannel implements NotificationChannelAdapter {
  readonly channel = 'EMAIL' as const;
  private readonly logger = new Logger(EmailChannel.name);

  constructor(
    private readonly config: CompareConfig,
    private readonly prisma: PrismaService,
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport,
  ) {}

  async deliver(digest: NotificationDigest): Promise<DeliveryResult> {
    if (!this.config.emailEnabled) {
      return { status: 'SKIPPED', reason: 'EMAIL_UNAVAILABLE: e-mail is niet ingeschakeld; melding blijft in-app beschikbaar' };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: digest.userId },
      select: { email: true, status: true, deletedAt: true, comparePreference: { select: { emailNotifications: true } } },
    });
    if (!user || user.status !== 'ACTIVE' || user.deletedAt) {
      return { status: 'SKIPPED', reason: 'ACCOUNT_INACTIVE' };
    }
    if (!user.comparePreference?.emailNotifications) {
      return { status: 'SKIPPED', reason: 'EMAIL_DISABLED_BY_USER: geen opt-in voor e-mailmeldingen' };
    }

    const email = buildDigestEmail(digest.notifications, this.config.webUrl, this.config.legalFooter);
    const result = await this.transport.send({
      to: user.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
      idempotencyKey: `superette:${digest.digestKey}:${digest.channel}`,
    });

    switch (result.status) {
      case 'SENT':
        this.logger.log(`e-mailoverzicht verstuurd userId=${digest.userId} meldingen=${digest.notifications.length} transport=${this.transport.kind}`);
        return { status: 'SENT' };
      case 'UNAVAILABLE':
        return { status: 'SKIPPED', reason: result.reason };
      case 'FAILED':
        this.logger.warn(`e-mailoverzicht mislukt userId=${digest.userId} fout=${result.error} permanent=${result.permanent}`);
        return { status: 'FAILED', error: result.error, permanent: result.permanent };
    }
  }
}
