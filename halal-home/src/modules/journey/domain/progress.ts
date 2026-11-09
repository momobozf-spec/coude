/**
 * Voortgang van een aankooptraject.
 *
 * ─── DE FORMULE, EXPLICIET ───────────────────────────────────────────────────
 *
 * Een gebruiker moet kunnen begrijpen waarom hij op 37 % staat. Daarom staat de
 * volledige rekenwijze hier, en geeft `explainProgress()` hem terug in woorden.
 *
 * PER FASE
 *
 *   Elke taak krijgt een gewicht:
 *       verplichte taak  → 1,0
 *       optionele taak   → 0,4
 *
 *   Een taak telt als "afgehandeld" bij COMPLETED óf SKIPPED. Overslaan is een
 *   geldig antwoord: wie geen garage heeft, is klaar met "garage-inspectie
 *   plannen". Hem open blijven tellen maakt 100 % onbereikbaar, en dan stopt de
 *   balk met betekenen.
 *
 *       stagePercentage = som(gewicht van afgehandelde taken)
 *                         ─────────────────────────────────── × 100
 *                            som(gewicht van alle taken)
 *
 *   Waarom optionele taken 0,4 en niet 0? Omdat ze dan onzichtbaar zouden zijn
 *   in de balk terwijl de gebruiker er wel werk aan heeft. En niet 1,0, omdat
 *   een fase dan niet op 100 % kan komen zonder werk dat we zelf optioneel
 *   noemden.
 *
 * OVER HET HELE TRAJECT
 *
 *   Fasen wegen NIET allemaal 10 %. Dat zou betekenen dat "oriëntatie" (drie
 *   taken) evenveel weegt als "financiering" (zeven taken, waaronder het
 *   financieringsbewijs). Het gewicht van een fase is het aantal taken erin:
 *
 *       journeyPercentage = som(gewicht afgehandelde taken, alle fasen)
 *                           ──────────────────────────────────────────── × 100
 *                              som(gewicht alle taken, alle fasen)
 *
 *   Met één correctie: de huidige fase vormt een ONDERGRENS. Wie in de
 *   notarisfase zit, staat nooit onder de voortgang die alleen al uit die fase
 *   volgt — anders zou vooruitgaan naar een fase met veel nieuwe open taken de
 *   balk laten zakken, en dat voelt als straf voor vooruitgang.
 *
 *   COMPLETED is altijd 100.
 */
import { JourneyStage, TaskStatus } from '@prisma/client'
import { STAGE_ORDER, STAGE_META, stageIndex } from './stages'

/** Het gewicht van een optionele taak ten opzichte van een verplichte. */
export const OPTIONAL_TASK_WEIGHT = 0.4
export const REQUIRED_TASK_WEIGHT = 1

export interface TaskProgressInput {
  status: TaskStatus
  optional?: boolean
}

export interface StageTaskProgressInput extends TaskProgressInput {
  stage: JourneyStage
}

export function isTaskResolved(status: TaskStatus): boolean {
  return status === TaskStatus.COMPLETED || status === TaskStatus.SKIPPED
}

export function taskWeight(task: TaskProgressInput): number {
  return task.optional ? OPTIONAL_TASK_WEIGHT : REQUIRED_TASK_WEIGHT
}

/**
 * Voortgang die alleen uit de fase volgt. COMPLETED is 100, de eerste fase 0.
 * De ondergrens, niet het antwoord.
 */
export function stageBaselinePercentage(stage: JourneyStage): number {
  const lastIndex = STAGE_ORDER.length - 1
  return Math.round((stageIndex(stage) / lastIndex) * 100)
}

export interface TaskBreakdown {
  total: number
  required: number
  optional: number
  completed: number
  skipped: number
  open: number
  /** Verplichte taken die nog niet afgehandeld zijn. Dit blokkeert de fase. */
  requiredOpen: number
}

export function breakdown(tasks: readonly TaskProgressInput[]): TaskBreakdown {
  const required = tasks.filter((t) => !t.optional)

  return {
    total: tasks.length,
    required: required.length,
    optional: tasks.length - required.length,
    completed: tasks.filter((t) => t.status === TaskStatus.COMPLETED).length,
    skipped: tasks.filter((t) => t.status === TaskStatus.SKIPPED).length,
    open: tasks.filter((t) => !isTaskResolved(t.status)).length,
    requiredOpen: required.filter((t) => !isTaskResolved(t.status)).length,
  }
}

/** Gewogen percentage over een verzameling taken. Geen taken → 0. */
export function weightedPercentage(tasks: readonly TaskProgressInput[]): number {
  if (tasks.length === 0) return 0

  const totalWeight = tasks.reduce((sum, task) => sum + taskWeight(task), 0)
  const doneWeight = tasks
    .filter((task) => isTaskResolved(task.status))
    .reduce((sum, task) => sum + taskWeight(task), 0)

  return Math.round((doneWeight / totalWeight) * 100)
}

export interface StageProgress {
  stage: JourneyStage
  label: string
  percentage: number
  breakdown: TaskBreakdown
  /** Alle verplichte taken afgehandeld? Dit bepaalt of de fase afgerond kan worden. */
  requiredComplete: boolean
}

/** Voortgang per fase, voor de tijdlijn. */
export function progressByStage(
  tasks: readonly StageTaskProgressInput[],
): StageProgress[] {
  return STAGE_ORDER.map((stage) => {
    const inStage = tasks.filter((t) => t.stage === stage)
    const stageBreakdown = breakdown(inStage)

    return {
      stage,
      label: STAGE_META[stage].label,
      percentage: weightedPercentage(inStage),
      breakdown: stageBreakdown,
      // Een fase zonder taken is niet "af" — er valt alleen niets af te vinken.
      // De stage-machine behandelt dat geval apart.
      requiredComplete: stageBreakdown.requiredOpen === 0,
    }
  })
}

export function stageProgressFor(
  stage: JourneyStage,
  tasks: readonly StageTaskProgressInput[],
): StageProgress {
  // Non-null: progressByStage geeft altijd een rij per fase uit STAGE_ORDER.
  return progressByStage(tasks).find((p) => p.stage === stage)!
}

/**
 * De voortgang die het dashboard toont.
 *
 * Zonder taken valt de berekening terug op de fase alleen — een vers traject
 * hoort niet op 0 % te blijven staan zolang de blauwdruk nog niet is toegepast.
 */
export function calculateProgress(
  stage: JourneyStage,
  tasks: readonly TaskProgressInput[],
): number {
  if (stage === JourneyStage.COMPLETED) return 100

  const baseline = stageBaselinePercentage(stage)
  if (tasks.length === 0) return baseline

  return Math.max(baseline, weightedPercentage(tasks))
}

export interface ProgressExplanation {
  percentage: number
  /** Regels die samen uitleggen hoe het percentage tot stand komt. */
  lines: string[]
  breakdown: TaskBreakdown
  /** Is het percentage bepaald door de fase-ondergrens in plaats van door taken? */
  baselineApplied: boolean
}

/**
 * Waarom sta ik op 37 %?
 *
 * Deze functie bestaat omdat een voortgangsbalk zonder uitleg een oordeel is
 * waar de gebruiker niets mee kan. Wat hier terugkomt, wordt letterlijk in de
 * UI getoond.
 */
export function explainProgress(
  stage: JourneyStage,
  tasks: readonly TaskProgressInput[],
): ProgressExplanation {
  const stats = breakdown(tasks)
  const percentage = calculateProgress(stage, tasks)
  const fromTasks = weightedPercentage(tasks)
  const baseline = stageBaselinePercentage(stage)
  const baselineApplied = tasks.length > 0 && baseline > fromTasks

  if (stage === JourneyStage.COMPLETED) {
    return {
      percentage: 100,
      lines: ['Je traject is afgerond.'],
      breakdown: stats,
      baselineApplied: false,
    }
  }

  const lines: string[] = []

  if (tasks.length === 0) {
    lines.push(`Je traject staat in de fase ${STAGE_META[stage].label.toLowerCase()}.`)
    lines.push('Er zijn nog geen taken; de voortgang volgt voorlopig uit je fase.')
    return { percentage, lines, breakdown: stats, baselineApplied: true }
  }

  lines.push(
    `${stats.completed + stats.skipped} van ${stats.total} taken afgehandeld ` +
      `(${stats.completed} voltooid, ${stats.skipped} overgeslagen).`,
  )

  if (stats.optional > 0) {
    lines.push(
      `Optionele taken tellen voor ${OPTIONAL_TASK_WEIGHT} mee, verplichte voor ${REQUIRED_TASK_WEIGHT}. ` +
        `Dat geeft ${fromTasks} %.`,
    )
  } else {
    lines.push(`Dat geeft ${fromTasks} %.`)
  }

  if (baselineApplied) {
    lines.push(
      `Je staat al in fase ${stageIndex(stage) + 1} van ${STAGE_ORDER.length}, ` +
        `dus je voortgang zakt niet onder ${baseline} %.`,
    )
  }

  if (stats.requiredOpen > 0) {
    lines.push(
      `Nog ${stats.requiredOpen} verplichte ${stats.requiredOpen === 1 ? 'taak' : 'taken'} ` +
        'voordat deze fase afgerond kan worden.',
    )
  }

  return { percentage, lines, breakdown: stats, baselineApplied }
}
