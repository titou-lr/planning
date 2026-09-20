import type { CalendarEvent, Task, TaskStatus } from './types'
import { expandEvents, fromDateKey, toDateKey } from './recurrence'
import { isClosedStatus } from './taskquery'

/**
 * Alertes d'échéance (§6.6) et rappels d'événements (§7.3) — purs.
 * La boucle de surveillance (UI) appelle ces fonctions puis déclenche
 * les notifications locales, en mémorisant ce qui a déjà été notifié.
 */

export type DeadlineKind = 'overdue' | 'imminent'

export interface DeadlineAlert {
  taskId: string
  title: string
  kind: DeadlineKind
  dueDate: string
}

/**
 * Tâches ouvertes en dépassement (échéance passée) ou, pour les
 * échéances dures, en dépassement imminent (dues aujourd'hui/demain).
 */
export function deadlineAlerts(tasks: Task[], statuses: TaskStatus[], now: Date): DeadlineAlert[] {
  const today = toDateKey(now)
  const tomorrow = toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  const out: DeadlineAlert[] = []
  for (const t of tasks) {
    if (!t.dueDate || isClosedStatus(statuses, t.statusId)) continue
    if (t.dueDate < today) {
      out.push({ taskId: t.id, title: t.title, kind: 'overdue', dueDate: t.dueDate })
    } else if (t.hardDeadline && (t.dueDate === today || t.dueDate === tomorrow)) {
      out.push({ taskId: t.id, title: t.title, kind: 'imminent', dueDate: t.dueDate })
    }
  }
  return out
}

/** Vrai si la tâche est en retard (échéance passée, non fermée). */
export function isOverdue(task: Task, statuses: TaskStatus[], now: Date): boolean {
  return (
    task.dueDate != null &&
    task.dueDate < toDateKey(now) &&
    !isClosedStatus(statuses, task.statusId)
  )
}

export interface ReminderDue {
  eventId: string
  title: string
  /** Début de l'occurrence concernée. */
  occurrenceStart: Date
  /** Clé unique de dédoublonnage (événement + occurrence). */
  key: string
}

/**
 * Rappels à déclencher : occurrences dont la fenêtre
 * [début − reminderMin, début] contient `now`.
 */
export function remindersDue(events: CalendarEvent[], now: Date): ReminderDue[] {
  const withReminder = events.filter((e) => e.reminderMin != null && e.reminderMin >= 0)
  if (!withReminder.length) return []
  // Fenêtre d'occurrences suffisante : maintenant → maintenant + max(reminder)
  const maxMin = Math.max(...withReminder.map((e) => e.reminderMin as number))
  const horizon = new Date(now.getTime() + (maxMin + 1) * 60000)
  const byId = new Map(withReminder.map((e) => [e.id, e]))
  const out: ReminderDue[] = []
  for (const occ of expandEvents(withReminder, now, horizon)) {
    const ev = byId.get(occ.eventId)
    if (!ev) continue
    const fireAt = occ.start.getTime() - (ev.reminderMin as number) * 60000
    if (fireAt <= now.getTime() && now.getTime() <= occ.start.getTime()) {
      out.push({
        eventId: ev.id,
        title: ev.title,
        occurrenceStart: occ.start,
        key: `${ev.id}@${occ.start.toISOString()}`,
      })
    }
  }
  return out
}

/** Projets en retard pour la vue portfolio (§6.5) : cible dépassée, non terminés. */
export function isProjectLate(
  project: { targetDate: string | null; health: string },
  now: Date
): boolean {
  if (!project.targetDate || project.health === 'done') return false
  return fromDateKey(project.targetDate) < new Date(now.getFullYear(), now.getMonth(), now.getDate())
}
