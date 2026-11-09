/**
 * De levenscyclus van een document, en waarom hij zo is.
 *
 * ─── HET KERNPROBLEEM: TWEE SYSTEMEN, GEEN TRANSACTIE ────────────────────────
 *
 * Een document bestaat op twee plekken: een rij in Postgres en een object in de
 * opslag. Die twee kunnen niet in één transactie. Er is dus altijd een moment
 * waarop de één bestaat en de ander niet, en elke storing valt precies daar.
 *
 * Vier scenario's, en wat we ermee doen:
 *
 *   1. Rij gemaakt, upload mislukt
 *      → status FAILED met een reden. Geen weesbestand: er staat niets in de
 *        opslag. De gebruiker ziet dat de upload mislukte en kan opnieuw.
 *
 *   2. Upload gelukt, rij bijwerken mislukt
 *      → er staat een object in de opslag met een rij die op PENDING blijft.
 *        `reconcile()` vindt dat en zet de rij alsnog op AVAILABLE (het bestand
 *        is er immers) of ruimt het object op. Geen verlies, geen wees.
 *
 *   3. Verwijderen: rij bijgewerkt, wissen mislukt
 *      → `deletedAt` gezet, `purgedAt` leeg. De gebruiker ziet het document als
 *        verwijderd, en `purgeOrphans()` probeert het wissen later opnieuw.
 *        Dit is het gevaarlijkste geval: iemand denkt dat zijn loonfiche weg is
 *        terwijl hij in de opslag staat. Daarom is het een expliciete, herhaalde
 *        opruimtaak en geen "we hopen dat het lukte".
 *
 *   4. Wissen gelukt, rij bijwerken mislukt
 *      → volgende poging vindt geen object; `delete` is idempotent, dus dat is
 *        geen fout. De rij wordt alsnog bijgewerkt.
 *
 * ─── WAT DIT NIET IS ─────────────────────────────────────────────────────────
 *
 * Geen distributed transaction en geen two-phase commit. Die zijn hier niet te
 * bouwen en zouden schijnzekerheid geven. Wat er wél is: een toestand die
 * altijd te herstellen is, en opruimacties die veilig meerdere keren mogen
 * draaien.
 */
import { DocumentStatus } from '@prisma/client'

/** Kan de gebruiker dit document openen of downloaden? */
export function isReadable(status: DocumentStatus): boolean {
  return status === DocumentStatus.AVAILABLE || status === DocumentStatus.EXPIRED
}

/** Telt dit document mee als "aanwezig" voor een checklist of aanbeveling? */
export function countsAsPresent(status: DocumentStatus): boolean {
  // EXPIRED telt niet mee: een verlopen attest is geen geldig bewijs meer.
  return status === DocumentStatus.AVAILABLE
}

/** Staat er (mogelijk) nog een bestand in de opslag? */
export function mayHaveStoredObject(document: {
  status: DocumentStatus
  purgedAt: Date | null
}): boolean {
  if (document.purgedAt !== null) return false
  return document.status !== DocumentStatus.FAILED
}

/**
 * Documenten die opgeruimd moeten worden.
 *
 * Twee soorten:
 *   - verwijderd maar niet gewist (`deletedAt` gezet, `purgedAt` leeg);
 *   - blijven hangen op PENDING (upload nooit bevestigd).
 *
 * De tweede categorie krijgt een respijtperiode: een upload die nog loopt mag
 * niet halverwege opgeruimd worden.
 */
export const PENDING_GRACE_MINUTES = 30

export interface CleanupCandidate {
  id: string
  storageKey: string
  status: DocumentStatus
  deletedAt: Date | null
  purgedAt: Date | null
  createdAt: Date
}

export type CleanupReason = 'deleted_not_purged' | 'stuck_pending'

export function needsCleanup(
  document: CleanupCandidate,
  now: Date = new Date(),
): CleanupReason | null {
  if (document.deletedAt !== null && document.purgedAt === null) {
    return 'deleted_not_purged'
  }

  if (document.status === DocumentStatus.PENDING) {
    const ageMinutes = (now.getTime() - document.createdAt.getTime()) / 60_000
    if (ageMinutes > PENDING_GRACE_MINUTES) return 'stuck_pending'
  }

  return null
}

/**
 * Wat er moet gebeuren met een rij die op PENDING staat.
 *
 * Hangt af van wat er werkelijk in de opslag ligt — daarom heeft
 * `StorageProvider` een `getMetadata`.
 */
export type ReconcileAction = 'mark_available' | 'mark_failed' | 'leave_alone'

export function reconcilePending(
  document: { status: DocumentStatus; createdAt: Date },
  storageHasObject: boolean,
  now: Date = new Date(),
): ReconcileAction {
  if (document.status !== DocumentStatus.PENDING) return 'leave_alone'

  // Het bestand staat er: de upload lukte, alleen het bijwerken van de rij niet.
  if (storageHasObject) return 'mark_available'

  const ageMinutes = (now.getTime() - document.createdAt.getTime()) / 60_000
  // Nog binnen de respijtperiode: de upload kan nog lopen.
  return ageMinutes > PENDING_GRACE_MINUTES ? 'mark_failed' : 'leave_alone'
}

/**
 * De labels die de gebruiker ziet.
 *
 * `DELETED` heet "Verwijderd" en niet "Gearchiveerd": wie op verwijderen klikt,
 * hoort te lezen dat het weg is — en dat is het ook, want het bestand wordt
 * gewist.
 */
export const STATUS_LABELS: Record<DocumentStatus, string> = {
  PENDING: 'Bezig met uploaden',
  AVAILABLE: 'Beschikbaar',
  FAILED: 'Upload mislukt',
  EXPIRED: 'Verlopen',
  DELETED: 'Verwijderd',
}

export const STATUS_HINTS: Record<DocumentStatus, string> = {
  PENDING: 'We wachten op de bevestiging van de opslag.',
  AVAILABLE: 'Het bestand staat klaar en is alleen voor jou toegankelijk.',
  FAILED: 'Er is geen bestand opgeslagen. Probeer het opnieuw.',
  EXPIRED: 'De geldigheidsdatum is verstreken. Vraag een recenter exemplaar op.',
  DELETED: 'Het bestand is uit de opslag gewist. Deze regel blijft voor je audittrail.',
}
