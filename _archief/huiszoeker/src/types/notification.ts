/**
 * Meldingen en hun bezorging.
 *
 * De `Notifier` krijgt een volledig samengestelde `PropertyNotification` — geen
 * database-ids, geen Prisma-modellen. Zo kan elke notifier los getest worden en
 * hoeft een nieuw kanaal (Slack, push, SMS) alleen te weten hoe hij tekst
 * verstuurt, niet hoe de applicatie in elkaar zit.
 */
import type { NotificationChannelType } from "../generated/prisma/enums.js";
import type { MatchReason } from "./matching.js";

export interface NotificationProperty {
  readonly title: string;
  readonly url: string;
  readonly city?: string;
  readonly propertyType?: string;
  readonly price?: number;
  readonly bedrooms?: number;
  readonly livingAreaM2?: number;
  readonly epcLabel?: string;
  readonly imageUrl?: string;
}

export interface NotificationItem {
  readonly matchId: string;
  readonly property: NotificationProperty;
  readonly score: number;
  readonly reasons: readonly MatchReason[];
  /** AI-tekst, uitsluitend gebaseerd op `property` en `reasons`. Ontbreekt
   *  wanneer geen AI-provider geconfigureerd is of de call faalde — een melding
   *  zonder samenvatting is beter dan geen melding. */
  readonly aiSummary?: string;
  /** Gevuld wanneer dit een prijsdaling is in plaats van een nieuw pand. */
  readonly priceDrop?: { readonly from: number; readonly to: number };
}

export interface PropertyNotification {
  readonly searchId: string;
  readonly searchName: string;
  /** Eén item → los bericht; meerdere → digest. De formatter beslist, niet de
   *  notifier: zo ziet elk kanaal dezelfde inhoud. */
  readonly items: readonly NotificationItem[];
}

export interface Notifier {
  readonly channel: NotificationChannelType;
  /** Gooit bij een permanente fout. De notificationService doet retry/backoff
   *  en logt NOTIFICATION_FAILED; de notifier zelf houdt geen state bij. */
  send(notification: PropertyNotification, config: unknown): Promise<void>;
}
