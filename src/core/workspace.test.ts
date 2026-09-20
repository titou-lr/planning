import { describe, expect, it } from 'vitest'
import { normalizeWorkspace } from './workspace'
import { makeStatuses, makeTask } from './testFactories'

describe('workspace — normalisation sans migration destructive', () => {
  it('donnée d’une version antérieure (notes seules) : tranches créées vides + workflow par défaut', () => {
    const w = normalizeWorkspace({ pages: [], versions: {} })
    expect(w.tasks).toEqual([])
    expect(w.events).toEqual([])
    expect(w.habits).toEqual([])
    expect(w.statuses.length).toBe(5)
    expect(w.statuses.map((s) => s.category)).toContain('done')
  })

  it('null / undefined / objet vide : workspace sain', () => {
    expect(normalizeWorkspace(null).pages).toEqual([])
    expect(normalizeWorkspace(undefined).tasks).toEqual([])
    expect(normalizeWorkspace({}).statuses.length).toBe(5)
  })

  it('tâche partielle : défauts complétés sans perdre les champs présents', () => {
    const w = normalizeWorkspace({
      statuses: makeStatuses(),
      tasks: [{ id: 'x', title: 'Ma tâche', statusId: 'todo' } as never],
    })
    expect(w.tasks[0]).toMatchObject({
      id: 'x', title: 'Ma tâche', statusId: 'todo',
      blockedBy: [], checklist: [], labelIds: [], priority: 0, hardDeadline: false,
    })
  })

  it('statut orphelin réaffecté au premier statut du workflow', () => {
    const statuses = makeStatuses()
    const w = normalizeWorkspace({ statuses, tasks: [makeTask({ statusId: 'disparu' })] })
    expect(w.tasks[0].statusId).toBe(statuses[0].id)
  })

  it('les tâches sans id (donnée corrompue) sont écartées, pas de crash', () => {
    const w = normalizeWorkspace({ tasks: [{ title: 'sans id' } as never, null as never] })
    expect(w.tasks).toEqual([])
  })
})
