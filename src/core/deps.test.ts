import { describe, expect, it } from 'vitest'
import { blockedByMe, blockersOf, findCycles, isBlocked, wouldCreateCycle } from './deps'
import { makeTask } from './testFactories'

describe('deps — graphe de dépendances', () => {
  it('détecte une auto-dépendance', () => {
    const tasks = [makeTask({ id: 'a' })]
    expect(wouldCreateCycle(tasks, 'a', 'a')).toBe(true)
  })

  it('accepte une arête sans cycle', () => {
    const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b' })]
    expect(wouldCreateCycle(tasks, 'a', 'b')).toBe(false)
  })

  it('refuse un cycle direct a→b→a', () => {
    const tasks = [makeTask({ id: 'a', blockedBy: ['b'] }), makeTask({ id: 'b' })]
    // b serait bloquée par a alors que a est déjà bloquée par b
    expect(wouldCreateCycle(tasks, 'b', 'a')).toBe(true)
  })

  it('refuse un cycle indirect a→b→c→a', () => {
    const tasks = [
      makeTask({ id: 'a', blockedBy: ['b'] }),
      makeTask({ id: 'b', blockedBy: ['c'] }),
      makeTask({ id: 'c' }),
    ]
    expect(wouldCreateCycle(tasks, 'c', 'a')).toBe(true)
    expect(wouldCreateCycle(tasks, 'c', 'b')).toBe(true)
    // L'inverse (a déjà en amont) reste possible dans l'autre sens… non : a bloquée par c ne crée pas de cycle
    expect(wouldCreateCycle(tasks, 'a', 'c')).toBe(false)
  })

  it('gère un graphe en losange sans faux positif', () => {
    // d bloquée par b et c, chacune bloquée par a — pas un cycle
    const tasks = [
      makeTask({ id: 'a' }),
      makeTask({ id: 'b', blockedBy: ['a'] }),
      makeTask({ id: 'c', blockedBy: ['a'] }),
      makeTask({ id: 'd', blockedBy: ['b', 'c'] }),
    ]
    expect(wouldCreateCycle(tasks, 'd', 'a')).toBe(false)
    expect(findCycles(tasks)).toEqual([])
  })

  it('signale un cycle existant (donnée importée)', () => {
    const tasks = [
      makeTask({ id: 'a', blockedBy: ['b'] }),
      makeTask({ id: 'b', blockedBy: ['c'] }),
      makeTask({ id: 'c', blockedBy: ['a'] }),
      makeTask({ id: 'sain' }),
    ]
    const cycles = findCycles(tasks)
    expect(cycles).toHaveLength(1)
    expect(new Set(cycles[0])).toEqual(new Set(['a', 'b', 'c']))
  })

  it('ignore les références vers des tâches supprimées', () => {
    const tasks = [makeTask({ id: 'a', blockedBy: ['fantôme'] })]
    expect(findCycles(tasks)).toEqual([])
    expect(wouldCreateCycle(tasks, 'x', 'a')).toBe(false)
  })

  it('blockersOf / blockedByMe exposent les deux sens', () => {
    const tasks = [makeTask({ id: 'a', blockedBy: ['b'] }), makeTask({ id: 'b' })]
    expect(blockersOf(tasks, 'a')).toEqual(['b'])
    expect(blockedByMe(tasks, 'b')).toEqual(['a'])
  })

  it('isBlocked dépend du statut du bloqueur', () => {
    const tasks = [
      makeTask({ id: 'a', blockedBy: ['b'] }),
      makeTask({ id: 'b', statusId: 'done' }),
    ]
    const closed = (sid: string) => sid === 'done'
    expect(isBlocked(tasks, 'a', closed)).toBe(false)
    const tasks2 = [makeTask({ id: 'a', blockedBy: ['b'] }), makeTask({ id: 'b', statusId: 'todo' })]
    expect(isBlocked(tasks2, 'a', closed)).toBe(true)
  })
})
