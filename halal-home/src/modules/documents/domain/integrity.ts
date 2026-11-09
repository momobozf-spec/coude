/**
 * Integriteit van geüploade bestanden.
 *
 * ─── WAT EEN CHECKSUM WÉL ZEGT ───────────────────────────────────────────────
 *
 * "Deze bytes zijn niet gewijzigd sinds wij ze ontvingen." Daarmee kunnen we:
 *   - een AI-uitleg vastpinnen op de versie waarop hij gebaseerd is;
 *   - een dubbele upload herkennen zonder het bestand opnieuw te lezen;
 *   - later zien of een bestand in de opslag nog overeenkomt met de rij.
 *
 * ─── WAT HIJ NIET ZEGT ───────────────────────────────────────────────────────
 *
 * Niets over echtheid. Een sha256 van een vervalste akte is een perfect geldige
 * sha256. Dit is géén bewijs van juridische authenticiteit, en de UI mag het
 * nooit zo presenteren. Wie wil weten of een akte echt is, gaat naar de notaris.
 */
import { createHash } from 'node:crypto'

export const CHECKSUM_ALGORITHM = 'sha256'

/** sha256 van de inhoud, hex. */
export function computeChecksum(data: Buffer): string {
  return createHash(CHECKSUM_ALGORITHM).update(data).digest('hex')
}

/** Komt deze inhoud overeen met een eerder vastgelegde checksum? */
export function matchesChecksum(data: Buffer, expected: string): boolean {
  return computeChecksum(data) === expected
}

/**
 * Hoort een uitleg nog bij de huidige versie van het document?
 *
 * Wijkt de checksum af, dan is het bestand vervangen en beschrijft de uitleg
 * iets anders dan wat de gebruiker nu ziet. Dat moet de UI zeggen — een uitleg
 * die stilzwijgend bij een oudere versie hoort, is misleidend.
 *
 * Ontbrekende checksums geven `unknown`: bij oudere rijen kunnen we het niet
 * bepalen, en dan doen we alsof het klopt noch alsof het niet klopt.
 */
export type ExplanationFreshness = 'current' | 'outdated' | 'unknown'

export function explanationMatchesDocument(
  documentChecksum: string | null,
  explanationChecksum: string | null,
): ExplanationFreshness {
  if (!documentChecksum || !explanationChecksum) return 'unknown'
  return documentChecksum === explanationChecksum ? 'current' : 'outdated'
}

export const EXPLANATION_OUTDATED_NOTICE =
  'Dit bestand is gewijzigd sinds deze uitleg gemaakt is. De uitleg beschrijft een oudere versie.'

/**
 * Het disclaimer-zinnetje bij een checksum.
 *
 * Staat hier zodat er geen scherm kan bestaan dat de hash toont zonder erbij te
 * zeggen wat hij niet betekent.
 */
export const CHECKSUM_DISCLOSURE =
  'Deze controlewaarde legt vast dat het bestand niet gewijzigd is sinds je het uploadde. ' +
  'Het is geen bewijs dat het document echt of juridisch geldig is.'

/** Kort weergaveformaat: de eerste twaalf tekens volstaan om te vergelijken. */
export function shortChecksum(checksum: string | null): string {
  return checksum ? `${checksum.slice(0, 12)}…` : '—'
}
