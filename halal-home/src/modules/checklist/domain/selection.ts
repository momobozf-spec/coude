/**
 * Welke checklists gelden voor dít traject?
 *
 * Pure functie, geen database. Een template is van toepassing wanneer al haar
 * ingevulde criteria overeenkomen; een leeg criterium betekent "geldt altijd".
 *
 * Die regel is bewust permissief: een template zonder `region` geldt voor het
 * hele land. Zo kan een landelijke lijst naast een gewestelijke bestaan zonder
 * dat we voor elk gewest een kopie moeten onderhouden.
 */
import type {
  ChecklistScope,
  FinancingType,
  JourneyStage,
  PurchaseType,
} from '@prisma/client'

/** De velden van een template waarop we selecteren. */
export interface SelectableTemplate {
  id: string
  key: string
  scope: ChecklistScope
  country: string
  region: string | null
  stage: JourneyStage | null
  purchaseType: PurchaseType | null
  financingType: FinancingType | null
  firstHomeOnly: boolean
  active: boolean
  validFrom: Date | null
  validUntil: Date | null
  sortOrder: number
  version: number
}

/** De situatie van de gebruiker waartegen we matchen. */
export interface ChecklistContext {
  country: string
  region: string | null
  stage?: JourneyStage | null
  purchaseType?: PurchaseType | null
  financingType?: FinancingType | null
  firstHome: boolean
  scope?: ChecklistScope | null
  on?: Date
}

/**
 * Is deze template van toepassing?
 *
 * `stage` werkt anders dan de rest: wanneer de context géén fase noemt, tonen we
 * álle fasen (het volledige checklistoverzicht). Wanneer hij er wél een noemt,
 * matchen we alleen templates van die fase of zonder fase. Dat verschil is de
 * reden dat `/checklists` alles toont en een stagepagina alleen het relevante
 * deel.
 */
export function templateApplies<T extends SelectableTemplate>(
  template: T,
  context: ChecklistContext,
): boolean {
  if (!template.active) return false

  const on = context.on ?? new Date()
  if (template.validFrom && template.validFrom > on) return false
  if (template.validUntil && template.validUntil <= on) return false

  if (template.country !== context.country) return false
  if (template.region !== null && template.region !== context.region) return false

  if (context.scope != null && template.scope !== context.scope) return false

  if (context.stage != null && template.stage !== null && template.stage !== context.stage) {
    return false
  }

  if (
    template.purchaseType !== null &&
    context.purchaseType != null &&
    template.purchaseType !== context.purchaseType
  ) {
    return false
  }

  if (
    template.financingType !== null &&
    context.financingType != null &&
    template.financingType !== context.financingType
  ) {
    return false
  }

  if (template.firstHomeOnly && !context.firstHome) return false

  return true
}

/**
 * De toepasselijke templates, in weergavevolgorde.
 *
 * Bij twee templates met dezelfde `key` wint de hoogste versie. Dat maakt het
 * mogelijk een herziene lijst uit te rollen zonder de oude te verwijderen —
 * belangrijk, want bestaande voortgang hangt aan de items van de oude.
 */
export function selectTemplates<T extends SelectableTemplate>(
  templates: readonly T[],
  context: ChecklistContext,
): T[] {
  const applicable = templates.filter((t) => templateApplies(t, context))

  const newestByKey = new Map<string, T>()
  for (const template of applicable) {
    const existing = newestByKey.get(template.key)
    if (!existing || template.version > existing.version) {
      newestByKey.set(template.key, template)
    }
  }

  return [...newestByKey.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key),
  )
}
