import { describe, expect, it } from 'vitest'
import {
  detachTaskBlocks, dropFutureBlocksOfClosedTask, plannedMinutes, resizeFutureBlocks,
} from './timeblock'
import { makeEvent } from './testFactories'

const now = new Date(2026, 6, 15, 12, 0) // 15 juillet 2026, midi

describe('timeblock — cohérence tâche ↔ créneau (§7.2)', () => {
  it('redimensionne les créneaux futurs quand l’estimation change', () => {
    const future = makeEvent({
      taskId: 't1',
      start: new Date(2026, 6, 16, 9, 0).toISOString(),
      end: new Date(2026, 6, 16, 10, 0).toISOString(),
    })
    const past = makeEvent({
      taskId: 't1',
      start: new Date(2026, 6, 10, 9, 0).toISOString(),
      end: new Date(2026, 6, 10, 10, 0).toISOString(),
    })
    const out = resizeFutureBlocks([future, past], 't1', 90, now)
    expect(new Date(out[0].end).getTime() - new Date(out[0].start).getTime()).toBe(90 * 60000)
    // Le créneau passé reste intact (temps historique)
    expect(out[1]).toBe(past)
  })

  it('ne touche pas aux créneaux d’autres tâches ni aux récurrents', () => {
    const other = makeEvent({ taskId: 't2', start: new Date(2026, 6, 16, 9).toISOString(), end: new Date(2026, 6, 16, 10).toISOString() })
    const recurring = makeEvent({
      taskId: 't1',
      start: new Date(2026, 6, 16, 9).toISOString(),
      end: new Date(2026, 6, 16, 10).toISOString(),
      recurrence: { freq: 'weekly', interval: 1 },
    })
    const events = [other, recurring]
    expect(resizeFutureBlocks(events, 't1', 120, now)).toBe(events) // même référence : rien à changer
  })

  it('estimation nulle ou invalide : aucun changement', () => {
    const ev = makeEvent({ taskId: 't1', start: new Date(2026, 6, 16, 9).toISOString(), end: new Date(2026, 6, 16, 10).toISOString() })
    expect(resizeFutureBlocks([ev], 't1', null, now)).toEqual([ev])
    expect(resizeFutureBlocks([ev], 't1', 0, now)).toEqual([ev])
  })

  it('suppression de tâche : créneaux futurs retirés, passés déliés avec titre recopié', () => {
    const future = makeEvent({ taskId: 't1', title: '', start: new Date(2026, 6, 20, 9).toISOString(), end: new Date(2026, 6, 20, 10).toISOString() })
    const past = makeEvent({ taskId: 't1', title: '', start: new Date(2026, 6, 1, 9).toISOString(), end: new Date(2026, 6, 1, 10).toISOString() })
    const out = detachTaskBlocks([future, past], { id: 't1', title: 'Rédiger le rapport' }, now)
    expect(out).toHaveLength(1)
    expect(out[0].taskId).toBeNull()
    expect(out[0].title).toBe('Rédiger le rapport')
  })

  it('tâche fermée : les créneaux futurs disparaissent, les passés restent', () => {
    const future = makeEvent({ taskId: 't1', start: new Date(2026, 6, 20, 9).toISOString(), end: new Date(2026, 6, 20, 10).toISOString() })
    const past = makeEvent({ taskId: 't1', start: new Date(2026, 6, 1, 9).toISOString(), end: new Date(2026, 6, 1, 10).toISOString() })
    const out = dropFutureBlocksOfClosedTask([future, past], 't1', now)
    expect(out).toHaveLength(1)
    expect(out[0].taskId).toBe('t1')
  })

  it('plannedMinutes agrège les créneaux liés', () => {
    const a = makeEvent({ taskId: 't1', start: new Date(2026, 6, 16, 9).toISOString(), end: new Date(2026, 6, 16, 10).toISOString() })
    const b = makeEvent({ taskId: 't1', start: new Date(2026, 6, 17, 9).toISOString(), end: new Date(2026, 6, 17, 9, 45).toISOString() })
    expect(plannedMinutes([a, b], 't1')).toBe(105)
  })
})
