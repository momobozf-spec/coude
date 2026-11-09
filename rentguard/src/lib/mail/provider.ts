import type { SendChannel } from '@/lib/supabase/types';

/**
 * Aangetekende zending.
 *
 * Zie `docs/decisions/0001-aangetekende-zending-provider.md`.
 *
 * De belangrijkste regel staat niet in de code maar in de UI: het woord
 * "aangetekend" verschijnt uitsluitend bij `QERDS` en `HYBRID_POST`, en alleen
 * wanneer de provider daadwerkelijk geconfigureerd is én de zending geslaagd is.
 * `SELF_SERVICE` is aangetekend omdat de **gebruiker** het aangetekend
 * verstuurt, niet wij.
 */

export interface RegisteredMailRecipient {
  name: string;
  /** Volledig adres, met straat, nummer, postcode en gemeente. */
  address: string;
  email: string | null;
}

export interface RegisteredMailSendInput {
  channel: 'QERDS' | 'HYBRID_POST';
  recipient: RegisteredMailRecipient;
  senderName: string;
  senderAddress: string;
  subject: string;
  pdf: Uint8Array;
  fileName: string;
  /** Onze eigen referentie; komt terug in statusopvragingen. */
  reference: string;
}

export type RegisteredMailFailure =
  | 'NOT_CONFIGURED'
  | 'CHANNEL_NOT_SUPPORTED'
  | 'RECIPIENT_INCOMPLETE'
  | 'PROVIDER_REJECTED'
  | 'PROVIDER_UNREACHABLE';

export type RegisteredMailSendResult =
  | {
      ok: true;
      providerReference: string;
      /** Alles wat de provider teruggaf, als bewijsmateriaal bewaard. */
      proof: Record<string, unknown>;
    }
  | { ok: false; failure: RegisteredMailFailure; detail?: string };

export type RegisteredMailStatus =
  | 'PENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'REFUSED'
  | 'FAILED'
  | 'UNKNOWN';

export type RegisteredMailStatusResult =
  | {
      ok: true;
      status: RegisteredMailStatus;
      deliveredAt: string | null;
      proof: Record<string, unknown>;
    }
  | { ok: false; failure: RegisteredMailFailure; detail?: string };

export interface RegisteredMailProvider {
  readonly id: string;
  /** Kanalen die deze provider werkelijk aankan. */
  readonly channels: readonly ('QERDS' | 'HYBRID_POST')[];
  send(input: RegisteredMailSendInput): Promise<RegisteredMailSendResult>;
  getStatus(providerReference: string): Promise<RegisteredMailStatusResult>;
}

/** Kanalen die altijd beschikbaar zijn, ook zonder enige configuratie. */
export const ALWAYS_AVAILABLE_CHANNELS: SendChannel[] = [
  'SELF_SERVICE',
  'EMAIL_PLAIN',
];

/**
 * Stappenplan voor de gratis route. Dit is geen tekst die wij verzinnen over de
 * wet: het beschrijft een handeling aan een postloket.
 */
export const SELF_SERVICE_STEPS = {
  nl: [
    'Download de brief hieronder en druk hem af.',
    'Onderteken de brief met de hand.',
    'Neem de brief mee naar een bpost-kantoor of PostPunt.',
    'Vraag uitdrukkelijk om een AANGETEKENDE ZENDING. Een gewone postzegel volstaat niet.',
    'Bewaar het verzendingsbewijs dat u aan het loket krijgt. Dat bewijs is uw verzendingsdatum.',
    'Vraag eventueel een ontvangstbewijs, zodat u ook de ontvangstdatum kunt aantonen.',
    'Houd een kopie van de brief zelf bij.',
  ],
  fr: [
    'Téléchargez le courrier ci-dessous et imprimez-le.',
    'Signez le courrier à la main.',
    'Apportez le courrier dans un bureau bpost ou un Point Poste.',
    'Demandez explicitement un ENVOI RECOMMANDÉ. Un timbre ordinaire ne suffit pas.',
    "Conservez la preuve de dépôt remise au guichet. Elle atteste votre date d'envoi.",
    "Demandez éventuellement un accusé de réception, pour pouvoir prouver aussi la date de réception.",
    'Gardez une copie du courrier lui-même.',
  ],
} as const;
