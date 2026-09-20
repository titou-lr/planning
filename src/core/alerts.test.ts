import { describe, expect, it } from 'vitest'
import { deadlineAlerts, isOverdue, isProjectLate, remindersDue } from './alerts'
import { makeEvent, makeStatuses, makeTask } from './testFactories'

const statuses = makeStatuses()
const now = new Date(2026, 6, 15, 12, 0)

describe('alerts — échéances (§6.6)', () => {
  it('détecte dépassement constaté et imminent (échéance dure)', () => {
    const tasks = [
      makeTask({ id: 'late', dueDate: '2026-07-10' }),
      makeTask({ id: 'hard-today', dueDate: '2026-07-15', hardDeadline: true }),
      makeTask({ id: 'hard-tomorrow', dueDate: '2026-07-16', hardDeadline: true }),
      makeTask({ id: 'soft-today', dueDate: '2026-07-15' }), // pas dure → pas d'alerte imminente
      makeTask({ id: 'done-late', dueDate: '2026-07-01', statusId: 'done' }),
    ]
    const alerts = deadlineAlerts(tasks, statuses, now)
    expect(alerts.map((a) => `${a.taskId}:${a.kind}`)).toEqual([
      'late:overdue', 'hard-today:imminent', 'hard-tomorrow:imminent',
    ])
  })

  it('isOverdue ignore les tâches fermées', () => {
    expect(isOverdue(makeTask({ dueDate: '2026-07-01' }), statuses, now)).toBe(true)
    expect(isOverdue(makeTask({ dueDate: '2026-07-01', statusId: 'canceled' }), statuses, now)).toBe(false)
  })
})

describe('alerts — rappels (§7.3)', () => {
  it('déclenche dans la fenêtre [début − rappel, début]', () => {
    const soon = makeEvent({
      reminderMin: 30,
      start: new Date(2026, 6, 15, 12, 20).toISOString(),
      end: new Date(2026, 6, 15, 13, 0).toISOString(),
    })
    const farAway = makeEvent({
      reminderMin: 10,
      start: new Date(2026, 6, 15, 18, 0).toISOString(),
      end: new Date(2026, 6, 15, 19, 0).toISOString(),
    })
    const due = remindersDue([soon, farAway], now)
    expect(due).toHaveLength(1)
    expect(due[0].eventId).toBe(soon.id)
    expect(due[0].key).toContain(soon.id)
  })

  it('fonctionne sur une occurrence récurrente', () => {
    const daily = makeEvent({
      reminderMin: 15,
      start: new Date(2026, 6, 1, 12, 10).toISOString(),
      end: new Date(2026, 6, 1, 12, 40).toISOString(),
      recurrence: { freq: 'daily', interval: 1 },
    })
    const due = remindersDue([daily], now) // occurrence du 15/07 à 12h10, rappel dès 11h55
    expect(due).toHaveLength(1)
    expect(due[0].occurrenceStart.getDate()).toBe(15)
  })

  it('aucun rappel si reminderMin null', () => {
    expect(remindersDue([makeEvent({ reminderMin: null })], now)).toEqual([])
  })
})

describe('alerts — retard projet (portfolio §6.5)', () => {
  it('cible dépassée et projet non terminé', () => {
    expect(isProjectLate({ targetDate: '2026-07-10', health: 'active' }, now)).toBe(true)
    expect(isProjectLate({ targetDate: '2026-07-10', health: 'done' }, now)).toBe(false)
    expect(isProjectLate({ targetDate: '2026-08-01', health: 'active' }, now)).toBe(false)
    expect(isProjectLate({ targetDate: null, health: 'active' }, now)).toBe(false)
  })
})
