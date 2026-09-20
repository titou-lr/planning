import { describe, expect, it } from 'vitest'
import { EMPTY_WORKSPACE, type WorkspaceData } from '../types'
import { makeStatuses, makeTask } from '../testFactories'
import { computeInsights } from './insights'

const NOW = new Date('2026-07-15T12:00:00')

function ws(patch: Partial<WorkspaceData> = {}): WorkspaceData {
  return { ...EMPTY_WORKSPACE, statuses: makeStatuses(), ...patch }
}

describe('computeInsights', () => {
  it('rend un message de repli sans données', () => {
    const { lines } = computeInsights(ws(), NOW)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/pas encore assez/i)
  })

  it('agrège complétion, retards et priorités depuis les moteurs existants', () => {
    const data = ws({
      tasks: [
        makeTask({ id: 'a', statusId: 'done', completedAt: '2026-07-10T00:00:00.000Z', createdAt: '2026-07-08T00:00:00.000Z' }),
        makeTask({ id: 'b', statusId: 'todo', dueDate: '2026-07-01', title: 'En retard' }),
        makeTask({ id: 'c', statusId: 'todo', priority: 1 }),
      ],
    })
    const { lines } = computeInsights(data, NOW)
    expect(lines.some((l) => l.includes('1/3 terminées'))).toBe(true)
    expect(lines.some((l) => l.includes('en retard') && l.includes('En retard'))).toBe(true)
    expect(lines.some((l) => l.includes('priorité urgente'))).toBe(true)
  })

  it('inclut la vélocité du dernier cycle', () => {
    const data = ws({
      cycles: [{ id: 'c1', name: 'Cycle 1', startDate: '2026-07-06', endDate: '2026-07-19' }],
      tasks: [
        makeTask({ cycleId: 'c1', statusId: 'done' }),
        makeTask({ cycleId: 'c1', statusId: 'todo' }),
      ],
    })
    const { lines } = computeInsights(data, NOW)
    expect(lines.some((l) => l.includes('Cycle 1') && l.includes('1/2'))).toBe(true)
  })
})
