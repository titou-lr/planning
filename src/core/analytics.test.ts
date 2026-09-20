import { describe, expect, it } from 'vitest'
import {
  completionStats, countByPriority, goalProgress, minutesByProject, minutesByTask,
  projectProgress, sessionsInRange, velocityByCycle, workloadByDay,
} from './analytics'
import { makeEvent, makeStatuses, makeTask } from './testFactories'
import type { Cycle, Project, TimeSession } from './types'

const statuses = makeStatuses()
const now = new Date(2026, 6, 15, 12, 0)

const project: Project = {
  id: 'p1', name: 'Projet', description: '', color: 'cat-blue',
  health: 'active', startDate: null, targetDate: null, order: 0, createdAt: '',
}

describe('analytics', () => {
  it('vélocité par cycle : terminées + somme d’estimation', () => {
    const cycles: Cycle[] = [
      { id: 'c1', name: 'Cycle 1', startDate: '2026-06-01', endDate: '2026-06-14' },
      { id: 'c2', name: 'Cycle 2', startDate: '2026-06-15', endDate: '2026-06-28' },
    ]
    const tasks = [
      makeTask({ cycleId: 'c1', statusId: 'done', estimateMin: 60 }),
      makeTask({ cycleId: 'c1', statusId: 'done', estimateMin: 30 }),
      makeTask({ cycleId: 'c1', statusId: 'todo' }),
      makeTask({ cycleId: 'c2', statusId: 'done', estimateMin: 45 }),
    ]
    const v = velocityByCycle(tasks, cycles, statuses)
    expect(v[0]).toMatchObject({ name: 'Cycle 1', completed: 2, estimateMin: 90, total: 3 })
    expect(v[1]).toMatchObject({ name: 'Cycle 2', completed: 1, total: 1 })
  })

  it('taux de complétion : les annulées sortent du dénominateur', () => {
    const tasks = [
      makeTask({ statusId: 'done', createdAt: '2026-07-01T00:00:00Z', completedAt: '2026-07-03T00:00:00Z' }),
      makeTask({ statusId: 'todo' }),
      makeTask({ statusId: 'canceled' }),
    ]
    const s = completionStats(tasks, statuses)
    expect(s.rate).toBe(0.5)
    expect(s.avgResolutionDays).toBe(2)
  })

  it('répartition par priorité (urgente d’abord, aucune en dernier)', () => {
    const tasks = [makeTask({ priority: 1 }), makeTask({ priority: 1 }), makeTask({ priority: 0 })]
    const buckets = countByPriority(tasks)
    expect(buckets[0]).toMatchObject({ name: 'Urgente', count: 2 })
    expect(buckets[4]).toMatchObject({ name: 'Aucune', count: 1 })
  })

  it('progression projet et objectif dérivées', () => {
    const tasks = [
      makeTask({ id: 'a', projectId: 'p1', statusId: 'done' }),
      makeTask({ id: 'b', projectId: 'p1', statusId: 'todo' }),
      makeTask({ id: 'c', projectId: 'p1', statusId: 'canceled' }),
      makeTask({ id: 'd', statusId: 'done' }),
    ]
    expect(projectProgress(project, tasks, statuses)).toBe(0.5)
    const goal = { projectIds: ['p1'], taskIds: ['d'] }
    expect(goalProgress(goal, [project], tasks, statuses)).toBe(0.75)
  })

  it('charge de travail : créneaux liés + tâches dues non planifiées', () => {
    const events = [
      makeEvent({
        taskId: 't-planifiée',
        start: new Date(2026, 6, 15, 9).toISOString(),
        end: new Date(2026, 6, 15, 10, 30).toISOString(),
      }),
      makeEvent({ // événement sans tâche : pas de la charge de travail
        start: new Date(2026, 6, 15, 14).toISOString(),
        end: new Date(2026, 6, 15, 15).toISOString(),
      }),
    ]
    const tasks = [
      makeTask({ id: 't-planifiée', dueDate: '2026-07-15', estimateMin: 90 }),
      makeTask({ id: 't-due', dueDate: '2026-07-15', estimateMin: 45 }),
      makeTask({ id: 't-finie', dueDate: '2026-07-15', estimateMin: 999, statusId: 'done' }),
    ]
    const load = workloadByDay(tasks, events, statuses, new Date(2026, 6, 13), 7)
    const wed = load.find((d) => d.date === '2026-07-15')!
    expect(wed.plannedMin).toBe(90) // créneau lié uniquement
    expect(wed.dueMin).toBe(45) // tâche due non planifiée ; la planifiée et la finie sont exclues
  })

  it('suivi du temps : totaux par tâche et par projet, session en cours incluse', () => {
    const sessions: TimeSession[] = [
      { id: 's1', taskId: 'a', start: new Date(2026, 6, 15, 9).toISOString(), end: new Date(2026, 6, 15, 10).toISOString() },
      { id: 's2', taskId: 'a', start: new Date(2026, 6, 15, 11).toISOString(), end: null }, // en cours (now = 12h)
      { id: 's3', taskId: 'b', start: new Date(2026, 6, 14, 9).toISOString(), end: new Date(2026, 6, 14, 9, 30).toISOString() },
    ]
    expect(minutesByTask(sessions, now).get('a')).toBe(120)
    const tasks = [makeTask({ id: 'a', projectId: 'p1' }), makeTask({ id: 'b', projectId: null })]
    expect(minutesByProject(sessions, tasks, now).get('p1')).toBe(120)
    expect(minutesByProject(sessions, tasks, now).get(null)).toBe(30)
    expect(sessionsInRange(sessions, '2026-07-15', '2026-07-15')).toHaveLength(2)
  })
})
