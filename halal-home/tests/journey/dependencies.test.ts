import { describe, expect, it } from 'vitest'
import { TaskStatus } from '@prisma/client'

import {
  actionableTasks,
  findBlockedTasks,
  hasCycle,
  isTaskBlocked,
  type DependencyNode,
} from '@/modules/journey/domain/dependencies'
import {
  allDependencyKeys,
  blueprintTasksFor,
} from '@/modules/journey/domain/blueprint'

const node = (
  id: string,
  status: TaskStatus,
  dependsOn: string[] = [],
): DependencyNode => ({ id, title: `Taak ${id}`, status, dependsOn })

describe('geblokkeerde taken', () => {
  it('blokkeert een taak waarvan de voorwaarde nog open staat', () => {
    // Het kernscenario van dit platform: bieden zonder financieringsbewijs.
    const nodes = [
      node('financing_proof', TaskStatus.TODO),
      node('offer', TaskStatus.TODO, ['financing_proof']),
    ]

    const blocked = findBlockedTasks(nodes)
    expect(blocked).toHaveLength(1)
    expect(blocked[0]?.id).toBe('offer')
    expect(blocked[0]?.blockedBy[0]?.id).toBe('financing_proof')
  })

  it('deblokkeert zodra de voorwaarde af is', () => {
    const nodes = [
      node('financing_proof', TaskStatus.COMPLETED),
      node('offer', TaskStatus.TODO, ['financing_proof']),
    ]
    expect(findBlockedTasks(nodes)).toHaveLength(0)
  })

  it('behandelt een overgeslagen voorwaarde als afgehandeld', () => {
    const nodes = [
      node('optional_step', TaskStatus.SKIPPED),
      node('next', TaskStatus.TODO, ['optional_step']),
    ]
    expect(isTaskBlocked('next', nodes)).toBe(false)
  })

  it('meldt alle blokkerende taken, niet alleen de eerste', () => {
    const nodes = [
      node('a', TaskStatus.TODO),
      node('b', TaskStatus.TODO),
      node('c', TaskStatus.TODO, ['a', 'b']),
    ]
    expect(findBlockedTasks(nodes)[0]?.blockedBy).toHaveLength(2)
  })

  it('rapporteert een afgehandelde taak nooit als geblokkeerd', () => {
    const nodes = [
      node('a', TaskStatus.TODO),
      node('b', TaskStatus.COMPLETED, ['a']),
    ]
    expect(findBlockedTasks(nodes)).toHaveLength(0)
  })

  it('negeert een verwijzing naar een taak die niet bestaat', () => {
    // Kan gebeuren wanneer een blauwdruktaak verdwijnt terwijl een gebruiker al
    // een traject heeft. Dat mag zijn taak niet permanent blokkeren.
    const nodes = [node('a', TaskStatus.TODO, ['weg'])]
    expect(findBlockedTasks(nodes)).toHaveLength(0)
  })
})

describe('taken waar je nu aan kan beginnen', () => {
  it('geeft alleen de open en niet-geblokkeerde taken', () => {
    const nodes = [
      node('done', TaskStatus.COMPLETED),
      node('ready', TaskStatus.TODO),
      node('blocked', TaskStatus.TODO, ['waiting']),
      node('waiting', TaskStatus.IN_PROGRESS),
    ]

    const ids = actionableTasks(nodes).map((n) => n.id)
    expect(ids).toContain('ready')
    expect(ids).toContain('waiting')
    expect(ids).not.toContain('blocked')
    expect(ids).not.toContain('done')
  })
})

describe('cyclusdetectie', () => {
  it('vindt een directe cyclus', () => {
    expect(hasCycle([node('a', TaskStatus.TODO, ['b']), node('b', TaskStatus.TODO, ['a'])])).toBe(
      true,
    )
  })

  it('vindt een indirecte cyclus', () => {
    expect(
      hasCycle([
        node('a', TaskStatus.TODO, ['b']),
        node('b', TaskStatus.TODO, ['c']),
        node('c', TaskStatus.TODO, ['a']),
      ]),
    ).toBe(true)
  })

  it('meldt geen cyclus bij een gedeelde afhankelijkheid', () => {
    // Een ruit (a → b, a → c, b → d, c → d) is geen cyclus. Een naïeve
    // implementatie die alleen "al bezocht" bijhoudt, meldt hier onterecht wel.
    expect(
      hasCycle([
        node('d', TaskStatus.TODO, []),
        node('b', TaskStatus.TODO, ['d']),
        node('c', TaskStatus.TODO, ['d']),
        node('a', TaskStatus.TODO, ['b', 'c']),
      ]),
    ).toBe(false)
  })

  it('de Belgische blauwdruk bevat geen cyclus', () => {
    // Een cyclus zou elke betrokken taak permanent blokkeren en pas maanden
    // later opvallen bij een gebruiker die vastloopt.
    const tasks = blueprintTasksFor({ country: 'BE', firstHome: true })
    const nodes = tasks.map((task) =>
      node(task.key, TaskStatus.TODO, allDependencyKeys(task)),
    )
    expect(hasCycle(nodes)).toBe(false)
  })

  it('elke afhankelijkheid in de blauwdruk verwijst naar een bestaande taak', () => {
    const tasks = blueprintTasksFor({ country: 'BE', firstHome: true })
    const keys = new Set(tasks.map((t) => t.key))

    for (const task of tasks) {
      for (const dependency of allDependencyKeys(task)) {
        expect(keys, `${task.key} verwijst naar ${dependency}`).toContain(dependency)
      }
    }
  })

  it('de blauwdruk heeft unieke sleutels', () => {
    const keys = blueprintTasksFor({ country: 'BE', firstHome: true }).map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
