import type { CalendarEvent, Habit, Task, TaskStatus } from './types'
import { normalizeTask } from './workspace'

/** Fabriques partagées par les tests des moteurs — pas de logique. */

let seq = 0

export function makeTask(patch: Partial<Task> = {}): Task {
  seq++
  return normalizeTask({
    id: patch.id ?? `t${seq}`,
    title: `Tâche ${seq}`,
    statusId: 'todo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  })
}

export function makeStatuses(): TaskStatus[] {
  return [
    { id: 'backlog', name: 'Backlog', category: 'backlog', color: 'cat-gray', order: 0 },
    { id: 'todo', name: 'À faire', category: 'todo', color: 'cat-blue', order: 1 },
    { id: 'doing', name: 'En cours', category: 'inprogress', color: 'cat-yellow', order: 2 },
    { id: 'done', name: 'Terminé', category: 'done', color: 'cat-green', order: 3 },
    { id: 'canceled', name: 'Annulé', category: 'canceled', color: 'cat-red', order: 4 },
  ]
}

export function makeEvent(patch: Partial<CalendarEvent> = {}): CalendarEvent {
  seq++
  return {
    id: patch.id ?? `e${seq}`,
    title: `Événement ${seq}`,
    start: '2026-07-01T10:00:00',
    end: '2026-07-01T11:00:00',
    allDay: false,
    recurrence: null,
    exdates: [],
    reminderMin: null,
    taskId: null,
    color: 'cat-blue',
    notes: '',
    ...patch,
  }
}

export function makeHabit(patch: Partial<Habit> = {}): Habit {
  seq++
  return {
    id: patch.id ?? `h${seq}`,
    name: `Habitude ${seq}`,
    color: 'cat-teal',
    frequency: 'daily',
    timesPerWeek: 3,
    completions: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    archived: false,
    ...patch,
  }
}
