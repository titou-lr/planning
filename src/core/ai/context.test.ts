import { describe, expect, it } from 'vitest'
import { EMPTY_WORKSPACE, type Page, type WorkspaceData } from '../types'
import { makeStatuses, makeTask } from '../testFactories'
import { buildAssistantContext, pagesSection, referenceSection, tasksSection } from './context'

const NOW = new Date('2026-07-15T12:00:00')

function page(id: string, title: string, text = ''): Page {
  return {
    id, title, parentId: null, order: 0, kind: 'page',
    blocks: [{ id: `${id}b`, type: 'paragraph', text }],
    createdAt: '', updatedAt: '',
  }
}

function ws(patch: Partial<WorkspaceData> = {}): WorkspaceData {
  return { ...EMPTY_WORKSPACE, statuses: makeStatuses(), ...patch }
}

describe('contexte assistant (lecture seule)', () => {
  it('expose le référentiel avec les ids réels', () => {
    const s = referenceSection(ws({ projects: [{ id: 'p1', name: 'Alpha', description: '', color: 'cat-blue', health: 'active', startDate: null, targetDate: null, order: 0, createdAt: '' }] }))
    expect(s).toContain('p1 | Alpha')
    expect(s).toContain('todo | À faire')
  })

  it('tronque au-delà des bornes sans planter (usage à grande échelle)', () => {
    const pages = Array.from({ length: 500 }, (_, i) => page(`p${i}`, `Page ${i}`, 'x'.repeat(1000)))
    const tasks = Array.from({ length: 500 }, () => makeTask())
    const ctx = buildAssistantContext(ws({ pages, tasks }), NOW)
    expect(ctx).toContain('(tronqué)')
    expect(ctx.length).toBeLessThan(150_000)
  })

  it('filtre les tâches fermées avec openOnly', () => {
    const s = tasksSection(ws({
      tasks: [makeTask({ title: 'Ouverte', statusId: 'todo' }), makeTask({ title: 'Finie', statusId: 'done' })],
    }), { openOnly: true })
    expect(s).toContain('Ouverte')
    expect(s).not.toContain('Finie')
  })

  it('exclut les templates des pages', () => {
    const tpl = { ...page('t1', 'Modèle'), kind: 'template' as const }
    expect(pagesSection(ws({ pages: [page('p1', 'Vraie'), tpl] }))).not.toContain('Modèle')
  })
})
