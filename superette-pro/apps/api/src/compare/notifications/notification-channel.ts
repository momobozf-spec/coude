/**
 * De naad voor meldingskanalen.
 *
 * Vandaag: in-app (de opgeslagen rij ís de melding) en e-mail (uitgeschakeld
 * tot er een mailprovider gekoppeld is). Later: push, browsernotificaties.
 * De dispatcher groepeert meldingen per gebruiker per dag tot één overzicht
 * en levert dat aan het kanaal — nooit tien losse mails op één ochtend.
 */
import type { AlertNotification, NotificationChannel } from '@superette/contracts';

/** Nest injection token voor de lijst van kanalen. */
export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');

export interface NotificationDigest {
  readonly userId: string;
  readonly channel: NotificationChannel;
  /** Sleutel gebruiker+dag; één overzicht per sleutel. */
  readonly digestKey: string;
  readonly notifications: readonly AlertNotification[];
}

export type DeliveryResult =
  | { readonly status: 'SENT' }
  | { readonly status: 'SKIPPED'; readonly reason: string }
  /** `permanent: true` = meteen definitief mislukt, geen retry (bv. ongeldig adres). */
  | { readonly status: 'FAILED'; readonly error: string; readonly permanent?: boolean };

export interface NotificationChannelAdapter {
  readonly channel: NotificationChannel;
  /**
   * Levert één overzicht af. Moet idempotent omgaan met een herhaalde
   * aanroep voor dezelfde `digestKey` (de dispatcher voorkomt dat al, maar
   * een kanaal mag er niet van afhangen).
   */
  deliver(digest: NotificationDigest): Promise<DeliveryResult>;
}
