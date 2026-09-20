import { describe, expect, it } from 'vitest'
import { EMPTY_WORKSPACE, type WorkspaceData } from '../types'
import { makeStatuses, makeTask } from '../testFactories'
import { extractJson, sanitizeProposals } from './proposals'

function ws(patch: Partial<WorkspaceData> = {}): WorkspaceData {
  return {
    ...EMPTY_WORKSPACE,
    statuses: makeStatuses(),
    labels: [{ id: 'l1', name: 'Perso', color: 'cat-pink' }],
    projects: [{ id: 'p1', name: 'Projet A', description: '', color: 'cat-blue', health: 'active', startDate: null, targetDate: null, order: 0, createdAt: '' }],
    tasks: [makeTask({ id: 'task1', priority: 0, projectId: null })],
    ...patch,
  }
}

describe('extractJson', () => {
  it('lit un tableau JSON nu', () => {
    expect(extractJson('[{"a":1}]')).toEqual([{ a: 1 }])
  })
  it('lit un JSON dans un fence markdown avec texte autour', () => {
    expect(extractJson('Voici :\n```json\n[{"kind":"createTask"}]\n```\nfin')).toEqual([{ kind: 'createTask' }])
  })
  it('rend null sur du texte sans JSON', () => {
    expect(extractJson('rien à voir')).toBeNull()
  })
})

describe('sanitizeProposals', () => {
  it('accepte une création de tâche valide et rejette les ids inconnus', () => {
    const out = sanitizeProposals([
      { kind: 'createTask', title: 'OK', priority: 2, projectId: 'p1', dueDate: '2026-08-01' },
      { kind: 'createTask', title: 'Projet inconnu ignoré', projectId: 'zzz' },
      { kind: 'createTask', title: '' }, // titre vide → écartée
    ], ws())
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ kind: 'createTask', title: 'OK', priority: 2, projectId: 'p1', dueDate: '2026-08-01' })
    expect(out[1]).toMatchObject({ projectId: null })
  })

  it('valide updateTask contre la tâche réelle et écarte les patchs vides', () => {
    const out = sanitizeProposals([
      { kind: 'updateTask', taskId: 'task1', patch: { priority: 1, statusId: 'doing' } },
      { kind: 'updateTask', taskId: 'inconnue', patch: { priority: 1 } },
      { kind: 'updateTask', taskId: 'task1', patch: { statusId: 'faux-statut' } }, // rien de valide → écartée
    ], ws())
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ kind: 'updateTask', taskId: 'task1', patch: { priority: 1, statusId: 'doing' } })
  })

  it('rejette dates invalides et événements incohérents', () => {
    const out = sanitizeProposals([
      { kind: 'createTask', title: 'Date invalide', dueDate: '2026-13-45' },
      { kind: 'createEvent', title: 'Fin avant début', start: '2026-07-02T10:00:00', end: '2026-07-02T09:00:00' },
      { kind: 'createEvent', title: 'OK', start: '2026-07-02T10:00:00', end: '2026-07-02T11:00:00' },
    ], ws())
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ kind: 'createTask', dueDate: null })
    expect(out[1].kind).toBe('createEvent')
  })

  it('dégrade sans crash sur une entrée illisible et borne le volume', () => {
    expect(sanitizeProposals('n’importe quoi', ws())).toEqual([])
    expect(sanitizeProposals(null, ws())).toEqual([])
    const many = Array.from({ length: 50 }, (_, i) => ({ kind: 'createTask', title: `T${i}` }))
    expect(sanitizeProposals(many, ws()).length).toBeLessThanOrEqual(20)
  })

  it('accepte l’enveloppe {proposals: []}', () => {
    const out = sanitizeProposals({ proposals: [{ kind: 'createPage', title: 'Note', markdown: '# a' }] }, ws())
    expect(out).toEqual([{ kind: 'createPage', title: 'Note', markdown: '# a' }])
  })
})
