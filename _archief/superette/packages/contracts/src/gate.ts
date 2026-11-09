import { z } from 'zod';

/**
 * Waarom de deur wél of niet openging. Elke waarde landt in `AccessLog.reason`.
 *
 * Belangrijk: de API geeft naar de scanner toe een *generieke* melding terug.
 * Deze fijnmazige redenen zijn voor de audit-trail en de support-desk, niet om
 * op het schermpje aan de deur te tonen — anders vertel je een aanvaller
 * precies welke stap hij nog moet omzeilen.
 */
export const gateResultSchema = z.enum([
  'GRANTED',
  /** Handtekening ongeldig, of de token is niet door ons uitgegeven. */
  'DENIED_INVALID_SIGNATURE',
  /** `exp` gepasseerd. Klant moet de app openen voor een verse QR. */
  'DENIED_EXPIRED',
  /** Deze nonce is al gebruikt — replay. */
  'DENIED_REPLAY',
  /** Er is intussen een nieuwere QR uitgegeven; deze is achterhaald. */
  'DENIED_SUPERSEDED',
  /** QR hoort bij een andere winkel. */
  'DENIED_WRONG_STORE',
  /** Account geblokkeerd, verwijderd, of openstaande onbetaalde mand. */
  'DENIED_USER_BLOCKED',
  /** Identiteit niet sterk geverifieerd terwijl de winkel dat vereist. */
  'DENIED_IDENTITY_REQUIRED',
  /** Verplichte AVG-toestemming (toegangslog of camera) ontbreekt of is ingetrokken. */
  'DENIED_CONSENT_MISSING',
  /** Buiten de openingsuren van deze winkel. */
  'DENIED_STORE_CLOSED',
  /** Maximale bezetting bereikt. */
  'DENIED_STORE_FULL',
  /**
   * Alles klopte, maar het deurrelais was niet bereikbaar via MQTT.
   * Geen weigering maar een storing — de klant treft geen blaam en de
   * compensatie (token terugdraaien, bezetting corrigeren) is al gebeurd.
   */
  'ERROR_GATE_UNREACHABLE',
]);
export type GateResult = z.infer<typeof gateResultSchema>;

/**
 * Request van de **deurscanner** naar de API — niet van de telefoon.
 *
 * Dit is de kern van het beveiligingsmodel: de app kan de deur niet openen.
 * Ze toont enkel een ondertekende claim. Zou de app `/gate/unlock` mogen
 * aanroepen, dan kan iedereen met een onderschepte token vanaf zijn zetel de
 * winkel openzetten.
 */
export const gateUnlockSchema = z.object({
  /** De compacte JWS die de scanner van het scherm las. */
  qrPayload: z.string().min(1).max(4096),
  /** De winkel waar deze scanner hangt. Moet matchen met de `sid` in de token. */
  storeId: z.string().min(1),
  /** Identificeert de fysieke scanner, voor de audit-trail. */
  deviceId: z.string().min(1).max(64),
});
export type GateUnlockInput = z.infer<typeof gateUnlockSchema>;

export const gateUnlockResponseSchema = z.object({
  granted: z.boolean(),
  /** Fijnmazige reden — voor logs en support, niet voor het scherm aan de deur. */
  result: gateResultSchema,
  /** Wat de scanner wél mag tonen. Vertaald naar de taal van de klant. */
  displayMessage: z.object({ nl: z.string(), fr: z.string() }),
  /** Aangemaakte winkelsessie bij GRANTED — hierop hangen de gescande producten. */
  basketId: z.string().nullable(),
});
export type GateUnlockResponse = z.infer<typeof gateUnlockResponseSchema>;

/** Klant verlaat de winkel; verlaagt de bezettingsteller. */
export const gateExitSchema = z.object({
  storeId: z.string().min(1),
  deviceId: z.string().min(1).max(64),
  basketId: z.string().min(1),
});
export type GateExitInput = z.infer<typeof gateExitSchema>;
