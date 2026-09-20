import type { CalendarEvent, Task } from './types'

/**
 * Cohérence time-blocking (§7.2) : lien tâche ↔ créneau calendrier.
 * Le créneau porte `taskId` ; le titre et l'état affichés sont dérivés
 * de la tâche au rendu (jamais dupliqués). Ici : les règles de
 * réconciliation quand la tâche change, pures et testées.
 */

/** Créneaux liés à une tâche. */
export function blocksOfTask(events: CalendarEvent[], taskId: string): CalendarEvent[] {
  return events.filter((e) => e.taskId === taskId)
}

/**
 * La durée estimée de la tâche a changé : les créneaux liés FUTURS
 * (début > now) sont redimensionnés à la nouvelle estimation. Les
 * créneaux passés ou en cours restent intacts (le temps déjà réservé
 * ou consommé est un fait historique). Retourne la même référence si
 * rien ne change.
 */
export function resizeFutureBlocks(
  events: CalendarEvent[],
  taskId: string,
  newEstimateMin: number | null,
  now: Date
): CalendarEvent[] {
  if (newEstimateMin == null || newEstimateMin <= 0) return events
  let changed = false
  const out = events.map((e) => {
    if (e.taskId !== taskId || e.recurrence) return e
    const start = new Date(e.start)
    if (isNaN(start.getTime()) || start <= now) return e
    const end = new Date(start.getTime() + newEstimateMin * 60 * 1000)
    if (end.toISOString() === new Date(e.end).toISOString()) return e
    changed = true
    return { ...e, end: end.toISOString() }
  })
  return changed ? out : events
}

/**
 * La tâche est supprimée : ses créneaux futurs sont retirés (plus rien
 * à travailler), les créneaux passés sont conservés mais déliés
 * (l'historique du calendrier reste vrai). Le titre de la tâche est
 * recopié une seule fois dans le créneau délié pour rester lisible.
 */
export function detachTaskBlocks(
  events: CalendarEvent[],
  task: Pick<Task, 'id' | 'title'>,
  now: Date
): CalendarEvent[] {
  let changed = false
  const out: CalendarEvent[] = []
  for (const e of events) {
    if (e.taskId !== task.id) {
      out.push(e)
      continue
    }
    changed = true
    const start = new Date(e.start)
    if (!isNaN(start.getTime()) && start > now) continue // futur → supprimé
    out.push({ ...e, taskId: null, title: e.title || task.title })
  }
  return changed ? out : events
}

/**
 * La tâche vient d'être fermée (terminée/annulée) : ses créneaux futurs
 * n'ont plus lieu d'être, ils sont supprimés. Les créneaux passés/en
 * cours restent (temps réellement passé).
 */
export function dropFutureBlocksOfClosedTask(
  events: CalendarEvent[],
  taskId: string,
  now: Date
): CalendarEvent[] {
  const out = events.filter((e) => {
    if (e.taskId !== taskId || e.recurrence) return true
    const start = new Date(e.start)
    return isNaN(start.getTime()) || start <= now
  })
  return out.length === events.length ? events : out
}

/** Minutes planifiées (créneaux liés) pour une tâche. */
export function plannedMinutes(events: CalendarEvent[], taskId: string): number {
  let total = 0
  for (const e of blocksOfTask(events, taskId)) {
    const ms = new Date(e.end).getTime() - new Date(e.start).getTime()
    if (!isNaN(ms) && ms > 0) total += ms / 60000
  }
  return Math.round(total)
}
