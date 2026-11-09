import type { ItemType, Priority } from './enums';
import type { IsoDate, IsoTime } from './ids';
import type { RecurrenceRule } from './recurrence';

/**
 * Quick capture: één invoerveld waar "Bel morgen om 14:00 met de boekhouder"
 * in gaat en een gestructureerde taak uit komt.
 *
 * De parser is een interface met een lokale regelgebaseerde implementatie.
 * Later kan er een AI-implementatie naast, zonder dat de UI verandert.
 */

export const TokenKind = {
  Date: 'DATE',
  Time: 'TIME',
  Priority: 'PRIORITY',
  Tag: 'TAG',
  Project: 'PROJECT',
  Recurrence: 'RECURRENCE',
  Type: 'TYPE',
  Duration: 'DURATION',
} as const;
export type TokenKind = (typeof TokenKind)[keyof typeof TokenKind];

/** Een stuk van de invoer dat de parser heeft herkend en uit de titel haalt. */
export interface CaptureToken {
  kind: TokenKind;
  /** De letterlijke tekst zoals de gebruiker die typte. */
  text: string;
  /** Positie in de originele invoer, voor highlighting terwijl je typt. */
  start: number;
  end: number;
  /** Het betrouwbaarheidsniveau, 0-1. Onder 0.5 tonen we het als suggestie. */
  confidence: number;
}

export interface CaptureResult {
  /** De invoer met alle herkende tokens eruit gestript. */
  title: string;
  /** Wat de gebruiker letterlijk typte. */
  raw: string;
  type: ItemType;
  dueDate: IsoDate | null;
  dueTime: IsoTime | null;
  priority: Priority | null;
  tagNames: string[];
  projectName: string | null;
  recurrence: RecurrenceRule | null;
  estimateMinutes: number | null;
  tokens: CaptureToken[];
}

/** Context die de parser nodig heeft om "morgen" en "volgende week" te duiden. */
export interface CaptureContext {
  /** Referentiemoment, altijd expliciet meegegeven zodat de parser puur blijft. */
  now: Date;
  timeZone: string;
  locale: 'nl' | 'en';
  weekStartsOn: 0 | 1;
  /** Bestaande projectnamen, voor het herkennen van `#project`. */
  knownProjects?: string[];
  /** Bestaande tags, voor het herkennen van `@tag`. */
  knownTags?: string[];
  /** Standaardtijd als er wel een datum maar geen tijd is genoemd. */
  defaultTime?: IsoTime;
}

export interface CaptureParser {
  readonly name: string;
  parse(input: string, ctx: CaptureContext): CaptureResult;
}
