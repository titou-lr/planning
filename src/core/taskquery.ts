import type { Task, TaskFilter, TaskSort, TaskStatus } from './types'
import { evalOp } from './automations'

/**
 * Filtres/tris combinables sur les tâches (§6.4) — pur, partagé par
 * toutes les vues (liste, kanban, calendrier, roadmap) et les vues
 * sauvegardées.
 */

function filterValue(task: Task, field: TaskFilter['field']) {
  switch (field) {
    case 'statusId': return task.statusId
    case 'priority': return task.priority
    case 'projectId': return task.projectId
    case 'cycleId': return task.cycleId
    case 'labelIds': return task.labelIds
    case 'dueDate': return task.dueDate
    case 'title': return task.title
  }
}

export function applyFilters(tasks: Task[], filters: TaskFilter[]): Task[] {
  if (!filters.length) return tasks
  return tasks.filter((t) => filters.every((f) => evalOp(f.op, filterValue(t, f.field), f.value)))
}

function sortKey(task: Task, field: TaskSort['field']): string | number {
  switch (field) {
    case 'priority': return task.priority === 0 ? 5 : task.priority
    case 'dueDate': return task.dueDate ?? '9999-12-31'
    case 'title': return task.title.toLowerCase()
    case 'createdAt': return task.createdAt
    case 'updatedAt': return task.updatedAt
    case 'order': return task.order
    case 'estimateMin': return task.estimateMin ?? Number.MAX_SAFE_INTEGER
  }
}

export function applySorts(tasks: Task[], sorts: TaskSort[]): Task[] {
  if (!sorts.length) return tasks
  return [...tasks].sort((a, b) => {
    for (const s of sorts) {
      const ka = sortKey(a, s.field)
      const kb = sortKey(b, s.field)
      if (ka < kb) return s.dir === 'asc' ? -1 : 1
      if (ka > kb) return s.dir === 'asc' ? 1 : -1
    }
    return a.order - b.order
  })
}

export function applyView(tasks: Task[], filters: TaskFilter[], sorts: TaskSort[]): Task[] {
  return applySorts(applyFilters(tasks, filters), sorts)
}

/* ---- Aides de statut partagées ---- */

export function statusById(statuses: TaskStatus[], id: string): TaskStatus | undefined {
  return statuses.find((s) => s.id === id)
}

export function isClosedStatus(statuses: TaskStatus[], statusId: string): boolean {
  const cat = statusById(statuses, statusId)?.category
  return cat === 'done' || cat === 'canceled'
}

export function isDoneStatus(statuses: TaskStatus[], statusId: string): boolean {
  return statusById(statuses, statusId)?.category === 'done'
}

/** Progression d'un ensemble de tâches : part des terminées parmi les non annulées. */
export function completionRatio(tasks: Task[], statuses: TaskStatus[]): number {
  const counted = tasks.filter((t) => statusById(statuses, t.statusId)?.category !== 'canceled')
  if (!counted.length) return 0
  const done = counted.filter((t) => isDoneStatus(statuses, t.statusId)).length
  return done / counted.length
}

export const PRIORITY_NAMES = ['Aucune', 'Urgente', 'Haute', 'Moyenne', 'Basse'] as const
