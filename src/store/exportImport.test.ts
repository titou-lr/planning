import { describe, expect, it, vi } from 'vitest'
import { makeLargeWorkspace, representativeWorkspace } from '../test/fixtures/workspace'
import { makeBackup, parseBackup } from './exportImport'

describe('sauvegarde globale', () => {
  it('préserve toutes les familles de données lors d’un aller-retour JSON', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-21T12:00:00.000Z'))

    const backup = makeBackup(representativeWorkspace, {
      id: 'profile-1', name: 'Perso', avatar: '🚀',
      createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: '2026-09-21T00:00:00.000Z',
    })
    const restored = parseBackup(JSON.stringify(backup))

    expect(backup.exportedAt).toBe('2026-09-21T12:00:00.000Z')
    expect(restored).toEqual(representativeWorkspace)
    vi.useRealTimers()
  })

  it('normalise une sauvegarde historique partielle', () => {
    const restored = parseBackup(JSON.stringify({
      app: 'suite-locale', version: 1, data: {
        pages: [{
          id: 'legacy-page', title: 'Ancienne page', parentId: null, order: 0,
          kind: 'page', blocks: [], createdAt: '', updatedAt: '',
        }],
        tasks: [{ id: 'legacy-task', title: 'Ancienne tâche' }],
      },
    }))

    expect(restored?.pages).toHaveLength(1)
    expect(restored?.tasks[0]).toMatchObject({ title: 'Ancienne tâche', attachments: [], checklist: [] })
    expect(restored?.statuses.length).toBeGreaterThan(0)
    expect(restored?.events).toEqual([])
  })

  it.each([
    ['', null],
    ['pas du JSON', null],
    ['{}', null],
    ['{"data":{"pages":"incorrect"}}', null],
  ])('refuse sans exception une sauvegarde corrompue', (input, expected) => {
    expect(parseBackup(input)).toBe(expected)
  })

  it('restaure un volume représentatif sans perte de comptage', () => {
    const large = makeLargeWorkspace()
    const restored = parseBackup(JSON.stringify(makeBackup(large, null)))

    expect(restored?.pages).toHaveLength(5_000)
    expect(restored?.tasks).toHaveLength(5_000)
  })
})
