/**
 * Openingsuren, uitgedrukt in minuten sinds middernacht in Europe/Brussels.
 *
 * Waarom niet gewoon UTC vergelijken? Omdat België twee keer per jaar van
 * tijdzone wisselt. Een winkel die "sluit om 23:00" moet in januari om 22:00 UTC
 * sluiten en in juli om 21:00 UTC. Wie dat als vaste UTC-offset hardcodeert,
 * laat de deur op 30 maart een uur te lang open — of te kort.
 */

const BRUSSELS = 'Europe/Brussels';

/** Vaste formatter: het aanmaken van een Intl-object is duur, dit gebeurt bij elke deuropening. */
const brusselsTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BRUSSELS,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Het aantal minuten sinds middernacht in Brussel, op het gegeven moment.
 * Bereik 0..1439.
 */
export function minutesSinceMidnightInBrussels(at: Date): number {
  const parts = brusselsTimeFormatter.formatToParts(at);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error(`Kon Brusselse tijd niet bepalen voor ${at.toISOString()}`);
  }

  // Intl geeft in en-GB met hour12:false middernacht als "24" terug, niet "00".
  return (hour % 24) * 60 + minute;
}

export interface OpeningHours {
  /** 0..1439. Bv. 360 = 06:00. */
  readonly opensAtMinute: number;
  /** 0..1439. Bv. 1380 = 23:00. */
  readonly closesAtMinute: number;
}

/**
 * Is de winkel open op dit moment van de dag?
 *
 * Het openingsvenster is half-open: `[opensAt, closesAt)`. Exact op sluitingstijd
 * gaat de deur niet meer open. Wie al binnen is, blijft binnen — de bezetting
 * loopt via `Store.currentOccupancy`, niet via dit venster.
 *
 * Loopt `closesAtMinute` vóór `opensAtMinute`, dan strekt het venster zich over
 * middernacht uit (bv. 22:00 → 02:00). Zijn ze gelijk, dan is de winkel 24/7 open.
 */
export function isWithinOpeningHours(nowMinute: number, hours: OpeningHours): boolean {
  const { opensAtMinute, closesAtMinute } = hours;

  assertMinute(nowMinute, 'nowMinute');
  assertMinute(opensAtMinute, 'opensAtMinute');
  assertMinute(closesAtMinute, 'closesAtMinute');

  if (opensAtMinute === closesAtMinute) return true; // 24/7

  if (opensAtMinute < closesAtMinute) {
    return nowMinute >= opensAtMinute && nowMinute < closesAtMinute;
  }

  // Venster over middernacht: open ná opensAt, óf vóór closesAt.
  return nowMinute >= opensAtMinute || nowMinute < closesAtMinute;
}

/** Gemaksfunctie: is deze winkel nú open? */
export function isStoreOpenAt(at: Date, hours: OpeningHours): boolean {
  return isWithinOpeningHours(minutesSinceMidnightInBrussels(at), hours);
}

function assertMinute(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 1439) {
    throw new RangeError(`${label} moet een geheel getal tussen 0 en 1439 zijn, kreeg: ${value}`);
  }
}
