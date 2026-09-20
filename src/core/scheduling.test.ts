import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PLAN_OPTIONS, freeSlots, orderTasks, planTasks,
  type PlanOptions, type SchedulableTask,
} from './scheduling'

function st(patch: Partial<SchedulableTask> & { id: string }): SchedulableTask {
  return {
    title: patch.id,
    estimateMin: 60,
    dueDate: null,
    hardDeadline: false,
    priority: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  }
}

// Lundi 6 juillet 2026, 9 h — semaine ouvrée pleine devant
const opts: PlanOptions = { ...DEFAULT_PLAN_OPTIONS, from: new Date(2026, 6, 6, 9, 0) }

describe('scheduling — ordre des candidates', () => {
  it('échéance dure > échéance proche > priorité > ancienneté', () => {
    const tasks = [
      st({ id: 'basse', priority: 4 }),
      st({ id: 'urgente', priority: 1 }),
      st({ id: 'due-loin', dueDate: '2026-07-20' }),
      st({ id: 'due-proche', dueDate: '2026-07-08' }),
      st({ id: 'dure', dueDate: '2026-07-15', hardDeadline: true }),
    ]
    expect(orderTasks(tasks).map((t) => t.id)).toEqual([
      'dure', 'due-proche', 'due-loin', 'urgente', 'basse',
    ])
  })

  it('est stable et déterministe (départage par createdAt puis id)', () => {
    const a = st({ id: 'a', createdAt: '2026-01-02' })
    const b = st({ id: 'b', createdAt: '2026-01-01' })
    expect(orderTasks([a, b]).map((t) => t.id)).toEqual(['b', 'a'])
    expect(orderTasks([b, a]).map((t) => t.id)).toEqual(['b', 'a'])
  })
})

describe('scheduling — créneaux libres', () => {
  it('respecte heures de travail, jours ouvrés et occupations', () => {
    const busy = [
      { start: new Date(2026, 6, 6, 10, 0), end: new Date(2026, 6, 6, 12, 0) },
    ]
    const slots = freeSlots(busy, { ...opts, horizonDays: 3 })
    // Lundi : 9-10 et 12-18 ; mardi/mercredi : 9-18 pleins
    expect(slots).toHaveLength(4)
    expect(slots[0].start.getHours()).toBe(9)
    expect(slots[0].end.getHours()).toBe(10)
    expect(slots[1].start.getHours()).toBe(12)
    expect(slots[1].end.getHours()).toBe(18)
  })

  it('exclut le week-end et le passé', () => {
    // Départ samedi 11 juillet 2026 → premier créneau lundi 13
    const satOpts = { ...opts, from: new Date(2026, 6, 11, 9, 0), horizonDays: 4 }
    const slots = freeSlots([], satOpts)
    expect(slots).toHaveLength(2) // lundi 13 + mardi 14
    expect(slots[0].start.getDay()).toBe(1)
  })

  it('démarre au milieu de la journée si from est en cours de journée', () => {
    const midOpts = { ...opts, from: new Date(2026, 6, 6, 14, 30), horizonDays: 1 }
    const slots = freeSlots([], midOpts)
    expect(slots).toHaveLength(1)
    expect(slots[0].start.getHours()).toBe(14)
    expect(slots[0].start.getMinutes()).toBe(30)
  })
})

describe('scheduling — placement', () => {
  it('first-fit : remplit les trous dans l’ordre, sans chevauchement', () => {
    const tasks = [
      st({ id: 'a', estimateMin: 120, dueDate: '2026-07-07' }),
      st({ id: 'b', estimateMin: 60, dueDate: '2026-07-08' }),
    ]
    const { placements, unplaced } = planTasks(tasks, [], opts)
    expect(unplaced).toEqual([])
    expect(placements[0].taskId).toBe('a')
    expect(placements[0].start.getTime()).toBe(new Date(2026, 6, 6, 9).getTime())
    expect(placements[0].end.getTime()).toBe(new Date(2026, 6, 6, 11).getTime())
    // b suit immédiatement dans le reste du créneau
    expect(placements[1].start.getTime()).toBe(new Date(2026, 6, 6, 11).getTime())
  })

  it('contourne les créneaux occupés', () => {
    const busy = [{ start: new Date(2026, 6, 6, 9, 0), end: new Date(2026, 6, 6, 17, 30) }]
    const { placements } = planTasks([st({ id: 'a', estimateMin: 60 })], busy, opts)
    // 17h30-18h trop court (60 min) → mardi 9h
    expect(placements[0].start.getTime()).toBe(new Date(2026, 6, 7, 9).getTime())
  })

  it('explique chaque placement, y compris un placement après échéance', () => {
    // Toute la semaine du 6 est occupée sauf mardi 14 juillet… on occupe 9 jours ouvrés — plus simple :
    const busyAllWeek = []
    for (let day = 6; day <= 10; day++) {
      busyAllWeek.push({ start: new Date(2026, 6, day, 9), end: new Date(2026, 6, day, 18) })
    }
    const { placements } = planTasks(
      [st({ id: 'a', estimateMin: 60, dueDate: '2026-07-08', hardDeadline: true, priority: 1 })],
      busyAllWeek,
      opts
    )
    expect(placements).toHaveLength(1)
    const reasons = placements[0].reasons.join(' | ')
    expect(reasons).toContain('échéance dure au 2026-07-08')
    expect(reasons).toContain('priorité urgente')
    expect(reasons).toContain('APRÈS l’échéance')
    expect(reasons).toContain('first-fit')
  })

  it('déclare non plaçable une tâche trop longue, avec raison', () => {
    const { placements, unplaced } = planTasks([st({ id: 'a', estimateMin: 600 })], [], opts)
    expect(placements).toEqual([])
    expect(unplaced[0].taskId).toBe('a')
    expect(unplaced[0].reasons.join(' ')).toContain('aucun créneau libre')
  })

  it('est déterministe : mêmes entrées → mêmes sorties', () => {
    const tasks = [
      st({ id: 'a', estimateMin: 90, priority: 2 }),
      st({ id: 'b', estimateMin: 45, dueDate: '2026-07-07' }),
      st({ id: 'c', estimateMin: 30 }),
    ]
    const r1 = planTasks(tasks, [], opts)
    const r2 = planTasks(tasks, [], opts)
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2))
  })
})
