/**
 * Demodata mag nooit doorgaan voor een echte aanbieder.
 *
 * ─── WAAROM DIT EEN EIGEN BESTAND IS ─────────────────────────────────────────
 *
 * Een verzonnen aanbieder ziet er in de interface precies hetzelfde uit als een
 * echte. Als de markering ergens vergeten wordt — in een lijst, een
 * vergelijking, een opgeslagen quote — dan leest een gebruiker die de app voor
 * het eerst opent een financieringsaanbod dat niet bestaat.
 *
 * De regels staan daarom in het domein en niet in een component, en
 * `assertDemoNeverVerified()` bewaakt de combinatie die nooit mag ontstaan.
 */
import type { ShariahAssessmentStatus } from '@prisma/client'

export const DEMO_LABEL = 'Voorbeeld'
export const DEMO_BADGE_TEXT = 'Voorbeeldproduct — bestaat niet'
export const DEMO_PROVIDER_BADGE_TEXT = 'Voorbeeldaanbieder — bestaat niet'

export const DEMO_EXPLANATION =
  'Deze aanbieder is verzonnen voor de ontwikkelomgeving en bestaat niet. ' +
  'De bedragen en voorwaarden zijn illustratief; gebruik ze nooit als basis voor een beslissing.'

export interface DemoCheckable {
  isDemo: boolean
  verified: boolean
}

export class DemoDataError extends Error {}

/**
 * Een demo-aanbieder kan per definitie niet geverifieerd zijn.
 *
 * `verified` betekent "een redacteur heeft het bestaan en de contactgegevens
 * gecontroleerd". Bij een verzonnen aanbieder valt er niets te controleren, dus
 * die combinatie is een datafout — en wel een die precies de misleiding
 * oplevert waar dit bestand tegen bestaat.
 *
 * Gooit in plaats van te corrigeren: stilzwijgend `verified` op false zetten
 * zou het probleem verbergen op de plek waar het ontstaat.
 */
export function assertDemoNeverVerified(record: DemoCheckable, label: string): void {
  if (record.isDemo && record.verified) {
    throw new DemoDataError(
      `${label} is gemarkeerd als demo én als geverifieerd. Die combinatie mag niet bestaan: ` +
        'een verzonnen aanbieder kan niet geverifieerd zijn.',
    )
  }
}

/** Mag deze rij aan een gebruiker getoond worden als échte aanbieder? */
export function isRealProvider(record: DemoCheckable): boolean {
  return !record.isDemo
}

/**
 * Splitst een lijst in echte en voorbeeldrecords.
 *
 * De UI toont ze in aparte secties met een eigen kop. Door elkaar zetten met
 * alleen een badge werkt niet: bij snel scannen vallen badges weg.
 */
export function splitDemo<T extends { isDemo: boolean }>(
  records: readonly T[],
): { real: T[]; demo: T[] } {
  return {
    real: records.filter((r) => !r.isDemo),
    demo: records.filter((r) => r.isDemo),
  }
}

/**
 * De tekst onder een demo-record.
 *
 * Ook wanneer het product een sterke shariah-status draagt: bij demodata zegt
 * die status niets, want er is geen echte aanbieder die de bewering doet.
 */
export function demoDisclosure(status?: ShariahAssessmentStatus | null): string[] {
  const lines = [DEMO_EXPLANATION]

  if (status && status !== 'UNKNOWN') {
    lines.push(
      'De shariah-status hieronder hoort bij dit voorbeeld en is dus ook verzonnen. ' +
        'Hij toont hoe een echte beoordeling er zou uitzien.',
    )
  }

  return lines
}
