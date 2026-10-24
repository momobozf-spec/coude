import { Injectable } from '@nestjs/common';
import type { DeliveryResult, NotificationChannelAdapter, NotificationDigest } from './notification-channel';

/**
 * In-app meldingen. De `AlertNotification`-rij is zelf de melding; de app
 * haalt ze op via `GET /compare/notifications`. "Afleveren" is dus niets
 * meer dan de rij als verzonden markeren — wat de dispatcher doet.
 */
@Injectable()
export class InAppChannel implements NotificationChannelAdapter {
  readonly channel = 'IN_APP' as const;

  deliver(_digest: NotificationDigest): Promise<DeliveryResult> {
    return Promise.resolve({ status: 'SENT' });
  }
}
