/**
 * Taakafhankelijkheden.
 *
 * "Financieringsbewijs ontvangen → bod uitbrengen" is niet decoratief: het is
 * de belangrijkste fout die dit platform hoort te voorkomen. Een geblokkeerde
 * taak wordt daarom niet verborgen maar getoond mét de reden, zodat de
 * gebruiker weet wat hij eerst moet doen.
 */
import { TaskStatus } from '@prisma/client'
import { isTaskResolved } from './progress'

export interface DependencyNode {
  id: string
  title: string
  status: TaskStatus
  /** Id's van taken die eerst af moeten. */
  dependsOn: readonly string[]
}

export interface BlockedTask {
  id: string
  /** De taken die deze taak tegenhouden. */
  blockedBy: { id: string; title: string }[]
}

/**
 * Welke taken zijn geblokkeerd, en waardoor?
 *
 * Alleen directe afhankelijkheden. Transitief doorrekenen zou de gebruiker een
 * lijst van vijf oorzaken tonen voor één taak, terwijl hij maar één ding
 * tegelijk kan doen: de eerstvolgende.
 */
export function findBlockedTasks(nodes: readonly DependencyNode[]): BlockedTask[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const blocked: BlockedTask[] = []

  for (const node of nodes) {
    if (isTaskResolved(node.status)) continue

    const blockers = node.dependsOn
      .map((id) => byId.get(id))
      .filter((dep): dep is DependencyNode => dep !== undefined && !isTaskResolved(dep.status))
      .map((dep) => ({ id: dep.id, title: dep.title }))

    if (blockers.length > 0) blocked.push({ id: node.id, blockedBy: blockers })
  }

  return blocked
}

export function isTaskBlocked(taskId: string, nodes: readonly DependencyNode[]): boolean {
  return findBlockedTasks(nodes).some((b) => b.id === taskId)
}

/**
 * De taken waar de gebruiker nú aan kan beginnen: open en niet geblokkeerd.
 * Dit is wat het dashboard onder "volgende stappen" toont.
 */
export function actionableTasks(nodes: readonly DependencyNode[]): DependencyNode[] {
  const blockedIds = new Set(findBlockedTasks(nodes).map((b) => b.id))
  return nodes.filter((n) => !isTaskResolved(n.status) && !blockedIds.has(n.id))
}

/**
 * Bevat de afhankelijkheidsgraaf een cyclus?
 *
 * Draait bij het toepassen van de blauwdruk. Een cyclus zou elke betrokken taak
 * permanent blokkeren, en dat is precies het soort fout dat pas maanden later
 * opvalt bij een gebruiker die vastloopt.
 */
export function hasCycle(nodes: readonly DependencyNode[]): boolean {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  // 0 = nog niet bezocht, 1 = op de huidige route, 2 = volledig afgehandeld.
  const state = new Map<string, 0 | 1 | 2>()

  const visit = (id: string): boolean => {
    const current = state.get(id) ?? 0
    if (current === 1) return true
    if (current === 2) return false

    state.set(id, 1)
    for (const depId of byId.get(id)?.dependsOn ?? []) {
      if (byId.has(depId) && visit(depId)) return true
    }
    state.set(id, 2)
    return false
  }

  return nodes.some((n) => visit(n.id))
}
