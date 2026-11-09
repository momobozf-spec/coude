/**
 * De toestand van elke fase in de tijdlijn.
 *
 * ─── DE UI BEPAALT NIET WAT LOCKED IS ────────────────────────────────────────
 *
 * Dit bestand is de enige plek waar wordt beslist of een fase open staat. Een
 * React-component die zelf `stageIndex > currentIndex ? 'locked' : 'open'`
 * berekent, is een tweede waarheid die stilletjes uit de pas gaat lopen met de
 * server — en dan ziet de gebruiker een klikbare fase die de API weigert.
 *
 * De vier toestanden:
 *
 *   COMPLETED  — ligt vóór de huidige fase; het werk is gedaan of overgeslagen.
 *   CURRENT    — waar de gebruiker nu staat.
 *   AVAILABLE  — de eerstvolgende fase, en de huidige fase is klaar om af te
 *                ronden. Dit is de enige fase waar hij naartoe kan.
 *   LOCKED     — verder weg, of de vorige fase is nog niet klaar.
 *
 * Terugkijken mag altijd: elke fase tot en met de huidige is leesbaar. Wat
 * `LOCKED` betekent is "hier kan je nog niet naartoe", niet "hier mag je niet
 * kijken" — een gebruiker die vooruit wil lezen wat hem te wachten staat, moet
 * dat kunnen.
 */
import { JourneyStage } from '@prisma/client'
import { STAGE_META, STAGE_ORDER, stageIndex } from './stages'
import type { StageProgress } from './progress'

export type StageState = 'COMPLETED' | 'CURRENT' | 'AVAILABLE' | 'LOCKED'

export interface StageView {
  stage: JourneyStage
  label: string
  description: string
  focus: string
  state: StageState
  /** Positie in het traject, 1-gebaseerd. Wat de UI toont als "fase 3 van 11". */
  position: number
  percentage: number
  requiredOpen: number
  totalTasks: number
  /** Mag de gebruiker deze fase openen en de inhoud zien? */
  readable: boolean
  /** Waarom is dit vergrendeld? Leeg wanneer dat niet zo is. */
  lockReason: string | null
}

/**
 * Bouwt de volledige tijdlijn.
 *
 * `stageProgress` komt uit `progressByStage()`; die is de bron voor de vraag of
 * de verplichte taken van een fase klaar zijn.
 */
export function buildStageViews(
  currentStage: JourneyStage,
  stageProgress: readonly StageProgress[],
): StageView[] {
  const currentIndex = stageIndex(currentStage)
  const progressByStage = new Map(stageProgress.map((p) => [p.stage, p]))

  const current = progressByStage.get(currentStage)
  // Een fase zonder taken kan niet "onaf" zijn — er valt niets af te vinken.
  const currentReady = current ? current.breakdown.requiredOpen === 0 : true

  return STAGE_ORDER.map((stage, index) => {
    const progress = progressByStage.get(stage)
    const meta = STAGE_META[stage]

    const state = resolveState(index, currentIndex, currentReady)

    return {
      stage,
      label: meta.label,
      description: meta.description,
      focus: meta.focus,
      state,
      position: index + 1,
      percentage: progress?.percentage ?? 0,
      requiredOpen: progress?.breakdown.requiredOpen ?? 0,
      totalTasks: progress?.breakdown.total ?? 0,
      // Vooruitlezen mag; vooruitspringen niet.
      readable: true,
      lockReason:
        state === 'LOCKED'
          ? index === currentIndex + 1
            ? `Rond eerst de verplichte taken van ${STAGE_META[currentStage].label.toLowerCase()} af.`
            : `Je komt hier na ${STAGE_META[STAGE_ORDER[index - 1]!].label.toLowerCase()}.`
          : null,
    }
  })
}

function resolveState(index: number, currentIndex: number, currentReady: boolean): StageState {
  if (index < currentIndex) return 'COMPLETED'
  if (index === currentIndex) return 'CURRENT'
  if (index === currentIndex + 1 && currentReady) return 'AVAILABLE'
  return 'LOCKED'
}

/**
 * Mag dit traject nu naar de volgende fase?
 *
 * Geeft een reden terug in plaats van alleen een boolean: "je kan nog niet
 * verder" zonder te zeggen waarom is precies de ondoorzichtigheid die dit
 * platform hoort weg te nemen.
 */
export interface AdvanceCheck {
  canAdvance: boolean
  nextStage: JourneyStage | null
  reason: string | null
  blockingTaskCount: number
}

export function canAdvanceStage(
  currentStage: JourneyStage,
  stageProgress: readonly StageProgress[],
): AdvanceCheck {
  const index = stageIndex(currentStage)
  const next = STAGE_ORDER[index + 1] ?? null

  if (next === null) {
    return {
      canAdvance: false,
      nextStage: null,
      reason: 'Dit is de laatste fase van je traject.',
      blockingTaskCount: 0,
    }
  }

  const progress = stageProgress.find((p) => p.stage === currentStage)
  const blocking = progress?.breakdown.requiredOpen ?? 0

  if (blocking > 0) {
    return {
      canAdvance: false,
      nextStage: next,
      reason: `Nog ${blocking} verplichte ${blocking === 1 ? 'taak' : 'taken'} open in deze fase.`,
      blockingTaskCount: blocking,
    }
  }

  return { canAdvance: true, nextStage: next, reason: null, blockingTaskCount: 0 }
}

/**
 * De fase waarin een traject hoort te starten, gegeven wat de gebruiker in de
 * onboarding aangaf.
 *
 * Wie al een woning gevonden heeft, hoort niet bij oriëntatie te beginnen en
 * negen fasen door te moeten klikken. Maar we slaan ook niet te ver door: ook
 * wie een woning heeft, moet zijn budget en financiering nog regelen — dus
 * `FOUND_PROPERTY` begint bij BUDGET, niet bij OFFER.
 */
export function startStageForGoal(goal: 'ORIENTING' | 'READY_TO_BUY' | 'FOUND_PROPERTY'): JourneyStage {
  switch (goal) {
    case 'ORIENTING':
      return JourneyStage.ORIENTATION
    case 'READY_TO_BUY':
      return JourneyStage.BUDGET
    case 'FOUND_PROPERTY':
      return JourneyStage.BUDGET
  }
}

/**
 * De fasen die als afgehandeld gelden wanneer een traject verderop start.
 *
 * Hun taken worden op SKIPPED gezet in plaats van weggelaten: de gebruiker moet
 * kunnen terugbladeren en alsnog iets afvinken dat hij oversloeg. Weglaten zou
 * die informatie permanent weggooien.
 */
export function stagesBefore(stage: JourneyStage): JourneyStage[] {
  return STAGE_ORDER.slice(0, stageIndex(stage))
}
