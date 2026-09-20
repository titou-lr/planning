import { describe, expect, it } from 'vitest'
import { applyFilters, applySorts, applyView, completionRatio, isClosedStatus } from './taskquery'
import { makeStatuses, makeTask } from './testFactories'

const statuses = makeStatuses()

describe('taskquery — filtres/tris combinables (§6.4)', () => {
  it('filtres combinés (ET)', () => {
    const tasks = [
      makeTask({ id: 'a', projectId: 'p1', priority: 1 }),
      makeTask({ id: 'b', projectId: 'p1', priority: 4 }),
      makeTask({ id: 'c', projectId: 'p2', priority: 1 }),
    ]
    const out = applyFilters(tasks, [
      { field: 'projectId', op: 'equals', value: 'p1' },
      { field: 'priority', op: 'equals', value: 1 },
    ])
    expect(out.map((t) => t.id)).toEqual(['a'])
  })

  it('filtre par étiquette (tableau) et par titre (contains)', () => {
    const tasks = [
      makeTask({ id: 'a', labelIds: ['bug'], title: 'Corriger export PDF' }),
      makeTask({ id: 'b', labelIds: ['feat'] }),
    ]
    expect(applyFilters(tasks, [{ field: 'labelIds', op: 'equals', value: 'bug' }]).map((t) => t.id)).toEqual(['a'])
    expect(applyFilters(tasks, [{ field: 'title', op: 'contains', value: 'pdf' }]).map((t) => t.id)).toEqual(['a'])
  })

  it('tris multi-critères, priorité 0 en dernier, échéance nulle en dernier', () => {
    const tasks = [
      makeTask({ id: 'sans-prio', priority: 0 }),
      makeTask({ id: 'urgente', priority: 1, dueDate: null }),
      makeTask({ id: 'urgente-due', priority: 1, dueDate: '2026-07-20' }),
    ]
    const out = applySorts(tasks, [
      { field: 'priority', dir: 'asc' },
      { field: 'dueDate', dir: 'asc' },
    ])
    expect(out.map((t) => t.id)).toEqual(['urgente-due', 'urgente', 'sans-prio'])
  })

  it('applyView compose filtres puis tris', () => {
    const tasks = [
      makeTask({ id: 'a', projectId: 'p1', dueDate: '2026-07-20' }),
      makeTask({ id: 'b', projectId: 'p1', dueDate: '2026-07-10' }),
      makeTask({ id: 'c', projectId: 'p2' }),
    ]
    const out = applyView(
      tasks,
      [{ field: 'projectId', op: 'equals', value: 'p1' }],
      [{ field: 'dueDate', dir: 'asc' }]
    )
    expect(out.map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('completionRatio exclut les annulées', () => {
    const tasks = [
      makeTask({ statusId: 'done' }),
      makeTask({ statusId: 'todo' }),
      makeTask({ statusId: 'canceled' }),
    ]
    expect(completionRatio(tasks, statuses)).toBe(0.5)
    expect(isClosedStatus(statuses, 'canceled')).toBe(true)
    expect(isClosedStatus(statuses, 'doing')).toBe(false)
  })
})
