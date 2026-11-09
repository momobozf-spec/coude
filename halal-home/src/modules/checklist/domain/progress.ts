/**
 * Voortgang op een checklist.
 *
 * Zelfde principe als bij taken: alleen REQUIRED-items blokkeren, en een item
 * dat de gebruiker als "niet van toepassing" markeert telt als afgehandeld.
 * Wie geen mazoutketel heeft, hoort niet eeuwig een openstaand item
 * "keuring stookolietank" te zien.
 */
import { ChecklistImportance } from '@prisma/client'

export const IMPORTANCE_LABELS: Record<ChecklistImportance, string> = {
  REQUIRED: 'Verplicht',
  RECOMMENDED: 'Aanbevolen',
  OPTIONAL: 'Optioneel',
}

/** Volgorde waarin secties en items getoond worden. */
export const IMPORTANCE_ORDER: Record<ChecklistImportance, number> = {
  REQUIRED: 0,
  RECOMMENDED: 1,
  OPTIONAL: 2,
}

export interface ChecklistItemState {
  importance: ChecklistImportance
  completed: boolean
  notApplicable: boolean
}

export function isItemResolved(item: ChecklistItemState): boolean {
  return item.completed || item.notApplicable
}

export interface ChecklistProgress {
  total: number
  resolved: number
  required: number
  requiredResolved: number
  requiredOpen: number
  percentage: number
  /** Alle verplichte items afgehandeld? */
  requiredComplete: boolean
}

export function checklistProgress(
  items: readonly ChecklistItemState[],
): ChecklistProgress {
  const required = items.filter((i) => i.importance === ChecklistImportance.REQUIRED)
  const requiredResolved = required.filter(isItemResolved).length
  const resolved = items.filter(isItemResolved).length

  return {
    total: items.length,
    resolved,
    required: required.length,
    requiredResolved,
    requiredOpen: required.length - requiredResolved,
    percentage: items.length === 0 ? 0 : Math.round((resolved / items.length) * 100),
    requiredComplete: required.length === requiredResolved,
  }
}

/**
 * De standaardtekst onder elke checklist.
 *
 * Staat hier en niet in een component, zodat er geen scherm kan bestaan dat een
 * checklist toont zonder dit voorbehoud. Een afgevinkte lijst mag nooit
 * overkomen als een juridische garantie dat een dossier volledig is.
 */
export const CHECKLIST_DISCLAIMER =
  'Deze checklist helpt je voorbereiden. Vereisten kunnen verschillen per regio, ' +
  'woning en dossier. Je notaris blijft de bron voor wat jouw dossier nodig heeft.'
