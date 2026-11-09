/**
 * De fasen van een aankooptraject.
 *
 * Dit bestand is de bron van waarheid voor de volgorde. Het Prisma-enum bepaalt
 * welke waarden bestaan; deze lijst bepaalt wat "volgende fase" en "verder dan"
 * betekenen. Beide moeten dezelfde elementen bevatten — `stages.test.ts` bewaakt
 * dat.
 *
 * Waarom een aparte array en niet `Object.values(JourneyStage)`? Omdat de
 * volgorde van een Prisma-enum een implementatiedetail van de generator is en
 * de betekenis van dit platform er letterlijk aan hangt. Als iemand ooit een
 * fase tussenvoegt in het schema, mag de progressieberekening niet stilletjes
 * van betekenis veranderen.
 */
import { JourneyStage } from '@prisma/client'

export const STAGE_ORDER: readonly JourneyStage[] = [
  JourneyStage.ORIENTATION,
  JourneyStage.BUDGET,
  JourneyStage.FINANCING,
  JourneyStage.PROPERTY_SEARCH,
  JourneyStage.VIEWINGS,
  JourneyStage.OFFER,
  JourneyStage.AGREEMENT,
  JourneyStage.NOTARY,
  JourneyStage.INSURANCE_ADMIN,
  JourneyStage.MOVING,
  JourneyStage.COMPLETED,
] as const

export interface StageMeta {
  /** Wat de gebruiker in de navigatie ziet. */
  label: string
  /** Eén zin: wat gebeurt er in deze fase? Geen jargon. */
  description: string
  /** De vraag "wat moet ik nu doen?", beantwoord in de imperatief. */
  focus: string
}

export const STAGE_META: Record<JourneyStage, StageMeta> = {
  ORIENTATION: {
    label: 'Oriëntatie',
    description: 'Je verkent wat je zoekt en wat er mogelijk is.',
    focus: 'Bepaal in welke buurt je wil wonen en wat je belangrijk vindt.',
  },
  BUDGET: {
    label: 'Budget',
    description: 'Je brengt in kaart wat je kan besteden, inclusief bijkomende kosten.',
    focus: 'Reken je eigen middelen en de aankoopkosten door.',
  },
  FINANCING: {
    label: 'Financiering',
    description: 'Je vergelijkt financieringsvormen en verzamelt de nodige documenten.',
    focus: 'Vergelijk aanbieders en leg je documenten klaar.',
  },
  PROPERTY_SEARCH: {
    label: 'Zoeken',
    description: 'Je zoekt actief naar woningen die bij je criteria passen.',
    focus: 'Zet je zoekopdrachten op en bewaar interessante woningen.',
  },
  VIEWINGS: {
    label: 'Bezichtigingen',
    description: 'Je plant bezoeken en beoordeelt woningen ter plaatse.',
    focus: 'Plan bezichtigingen en noteer je bevindingen.',
  },
  OFFER: {
    label: 'Bod',
    description: 'Je brengt een bod uit op een woning.',
    focus: 'Zorg dat je financiering rond is voordat je biedt.',
  },
  AGREEMENT: {
    label: 'Compromis',
    description: 'De verkoopovereenkomst wordt opgesteld en getekend.',
    focus: 'Lees de overeenkomst en de opschortende voorwaarden goed na.',
  },
  NOTARY: {
    label: 'Notaris',
    description: 'De notaris bereidt de akte voor en je tekent.',
    focus: 'Verzamel alle attesten die de notaris nodig heeft.',
  },
  INSURANCE_ADMIN: {
    label: 'Verzekering & administratie',
    description: 'Je regelt verzekeringen, nutsvoorzieningen en administratie.',
    focus: 'Regel je brandverzekering en zet de contracten op je naam.',
  },
  MOVING: {
    label: 'Verhuizen',
    description: 'Je bereidt de verhuis voor en voert hem uit.',
    focus: 'Plan de verhuis en werk de verhuischecklist af.',
  },
  COMPLETED: {
    label: 'Afgerond',
    description: 'Je woont in je nieuwe huis. Baraka fik!',
    focus: 'Ontdek je nieuwe buurt.',
  },
}

export function stageIndex(stage: JourneyStage): number {
  const index = STAGE_ORDER.indexOf(stage)
  // Kan alleen gebeuren als het Prisma-enum en STAGE_ORDER uit elkaar lopen.
  // Hard falen is hier juist: stil doorgaan met -1 zou elke vergelijking
  // hieronder omkeren.
  if (index === -1) throw new Error(`Onbekende fase: ${stage}`)
  return index
}

export function nextStage(stage: JourneyStage): JourneyStage | null {
  return STAGE_ORDER[stageIndex(stage) + 1] ?? null
}

export function previousStage(stage: JourneyStage): JourneyStage | null {
  const index = stageIndex(stage)
  return index === 0 ? null : (STAGE_ORDER[index - 1] ?? null)
}

/** Ligt `a` verder in het traject dan `b`? */
export function isAfter(a: JourneyStage, b: JourneyStage): boolean {
  return stageIndex(a) > stageIndex(b)
}

export function isAtOrAfter(a: JourneyStage, b: JourneyStage): boolean {
  return stageIndex(a) >= stageIndex(b)
}

/**
 * Mag een traject van `from` naar `to`?
 *
 * Vooruit: alleen één fase tegelijk. Overslaan zou taken en documenten stil
 * laten liggen die de volgende fase nodig heeft, en de gebruiker komt er dan
 * pas achter bij de notaris.
 *
 * Achteruit: altijd toegestaan, over meerdere fasen. Een afgeketste
 * financiering of een bod dat niet doorgaat is een normale gebeurtenis, geen
 * fout, en de gebruiker moet dan terug kunnen zonder een supportvraag.
 */
export function canTransition(from: JourneyStage, to: JourneyStage): boolean {
  if (from === to) return false
  const [a, b] = [stageIndex(from), stageIndex(to)]
  return b < a || b === a + 1
}

export function assertTransition(from: JourneyStage, to: JourneyStage): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Ongeldige fase-overgang: ${from} → ${to}. ` +
        'Vooruit kan alleen één fase tegelijk; terug mag altijd.',
    )
  }
}
