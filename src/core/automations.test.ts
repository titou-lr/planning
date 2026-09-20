import { describe, expect, it } from 'vitest'
import { matchesConditions, runAutomations } from './automations'
import { makeTask } from './testFactories'
import type { AutomationRule } from './types'

function rule(patch: Partial<AutomationRule>): AutomationRule {
  return {
    id: 'r1', name: 'Règle', enabled: true,
    trigger: 'task.created', conditions: [], actions: [],
    ...patch,
  }
}

const now = new Date(2026, 6, 15, 10, 0)

describe('automations — moteur déclencheur → condition → action', () => {
  it('applique une action quand déclencheur et conditions correspondent', () => {
    const r = rule({
      trigger: 'task.created',
      conditions: [{ field: 'title', op: 'contains', value: 'bug' }],
      actions: [{ type: 'setPriority', value: 1 }, { type: 'addLabel', value: 'lbl-bug' }],
    })
    const task = makeTask({ title: 'Corriger le BUG d’import' })
    const patch = runAutomations([r], 'task.created', task, now)
    expect(patch).toEqual({ priority: 1, labelIds: ['lbl-bug'] })
  })

  it('ignore les règles désactivées ou d’un autre déclencheur', () => {
    const r1 = rule({ enabled: false, actions: [{ type: 'setPriority', value: 1 }] })
    const r2 = rule({ trigger: 'task.completed', actions: [{ type: 'setPriority', value: 2 }] })
    const patch = runAutomations([r1, r2], 'task.created', makeTask({}), now)
    expect(patch).toEqual({})
  })

  it('conditions toutes requises (ET logique)', () => {
    const conds: AutomationRule['conditions'] = [
      { field: 'projectId', op: 'equals', value: 'p1' },
      { field: 'priority', op: 'gt', value: 2 },
    ]
    expect(matchesConditions(makeTask({ projectId: 'p1', priority: 3 }), conds)).toBe(true)
    expect(matchesConditions(makeTask({ projectId: 'p1', priority: 1 }), conds)).toBe(false)
    expect(matchesConditions(makeTask({ projectId: 'p2', priority: 3 }), conds)).toBe(false)
  })

  it('les règles se cumulent dans l’ordre (la suivante voit la tâche patchée)', () => {
    const r1 = rule({ id: 'a', actions: [{ type: 'setProject', value: 'p1' }] })
    const r2 = rule({
      id: 'b',
      conditions: [{ field: 'projectId', op: 'equals', value: 'p1' }],
      actions: [{ type: 'setCycle', value: 'c1' }],
    })
    const patch = runAutomations([r1, r2], 'task.created', makeTask({ projectId: null }), now)
    expect(patch).toEqual({ projectId: 'p1', cycleId: 'c1' })
  })

  it('setDueInDays calcule une date locale relative', () => {
    const r = rule({ actions: [{ type: 'setDueInDays', value: 7 }] })
    const patch = runAutomations([r], 'task.created', makeTask({}), now)
    expect(patch.dueDate).toBe('2026-07-22')
  })

  it('n’ajoute pas deux fois la même étiquette', () => {
    const r = rule({ actions: [{ type: 'addLabel', value: 'l1' }] })
    const patch = runAutomations([r], 'task.created', makeTask({ labelIds: ['l1'] }), now)
    expect(patch).toEqual({})
  })

  it('isEmpty / isNotEmpty sur valeurs vides et tableaux', () => {
    expect(matchesConditions(makeTask({ dueDate: null }), [{ field: 'dueDate', op: 'isEmpty' }])).toBe(true)
    expect(matchesConditions(makeTask({ labelIds: [] }), [{ field: 'labelIds', op: 'isEmpty' }])).toBe(true)
    expect(matchesConditions(makeTask({ labelIds: ['x'] }), [{ field: 'labelIds', op: 'isNotEmpty' }])).toBe(true)
  })
})
