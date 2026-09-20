import type { StatusCategory, Task, TaskStatus, WorkspaceData } from './types'
import { uid } from './id'

/**
 * Normalisation du workspace : garantit que toute donnée persistée
 * (version antérieure, sauvegarde importée, donnée partielle) obtient
 * des défauts sains sans migration destructive — les tranches absentes
 * sont créées vides, les champs de tâche manquants reçoivent leur défaut.
 */

export const STATUS_CATEGORIES: { id: StatusCategory; name: string }[] = [
  { id: 'backlog', name: 'Backlog' },
  { id: 'todo', name: 'À faire' },
  { id: 'inprogress', name: 'En cours' },
  { id: 'done', name: 'Terminé' },
  { id: 'canceled', name: 'Annulé' },
]

/** Workflow par défaut (personnalisable ensuite). */
export function defaultStatuses(): TaskStatus[] {
  return [
    { id: uid(), name: 'Backlog', category: 'backlog', color: 'cat-gray', order: 0 },
    { id: uid(), name: 'À faire', category: 'todo', color: 'cat-blue', order: 1 },
    { id: uid(), name: 'En cours', category: 'inprogress', color: 'cat-yellow', order: 2 },
    { id: uid(), name: 'Terminé', category: 'done', color: 'cat-green', order: 3 },
    { id: uid(), name: 'Annulé', category: 'canceled', color: 'cat-red', order: 4 },
  ]
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

/** Complète une tâche partielle (donnée ancienne/importée) avec ses défauts. */
export function normalizeTask(t: Partial<Task> & { id: string }): Task {
  return {
    title: '',
    blocks: [],
    statusId: '',
    priority: 0,
    labelIds: [],
    projectId: null,
    cycleId: null,
    parentId: null,
    order: 0,
    dueDate: null,
    hardDeadline: false,
    estimateMin: null,
    startDate: null,
    blockedBy: [],
    checklist: [],
    attachments: [],
    createdAt: '',
    updatedAt: '',
    completedAt: null,
    ...t,
  }
}

export function normalizeWorkspace(raw: Partial<WorkspaceData> | null | undefined): WorkspaceData {
  const statuses = arr<TaskStatus>(raw?.statuses)
  const effectiveStatuses = statuses.length ? statuses : defaultStatuses()
  const fallbackStatus = effectiveStatuses[0]
  const statusIds = new Set(effectiveStatuses.map((s) => s.id))
  return {
    pages: arr(raw?.pages),
    versions: raw?.versions && typeof raw.versions === 'object' ? raw.versions : {},
    tasks: arr<Task>(raw?.tasks)
      .filter((t) => t && typeof t.id === 'string')
      .map((t) => {
        const n = normalizeTask(t)
        // Statut orphelin (workflow modifié / import partiel) → premier statut
        return statusIds.has(n.statusId) ? n : { ...n, statusId: fallbackStatus.id }
      }),
    statuses: effectiveStatuses,
    labels: arr(raw?.labels),
    projects: arr(raw?.projects),
    cycles: arr(raw?.cycles),
    goals: arr(raw?.goals),
    savedTaskViews: arr(raw?.savedTaskViews),
    automations: arr(raw?.automations),
    projectTemplates: arr(raw?.projectTemplates),
    taskFields: arr(raw?.taskFields),
    events: arr(raw?.events),
    habits: arr(raw?.habits),
    sessions: arr(raw?.sessions),
  }
}
