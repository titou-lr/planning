import { fromDateKey } from './recurrence'

/**
 * Planification assistée par contraintes (§7.6) — algorithme glouton
 * déterministe et explicable, aucun génératif :
 *
 * 1. Les tâches candidates sont ordonnées par un tri total explicite :
 *    échéance dure d'abord, puis échéance la plus proche, puis priorité
 *    (1 = urgente avant 4 = basse, 0 = aucune en dernier), puis date de
 *    création (stabilité).
 * 2. Chaque tâche est posée dans le premier créneau libre assez long
 *    (first-fit) à l'intérieur des heures de travail, hors créneaux
 *    occupés. Pas de découpage : une tâche = un bloc.
 * 3. Chaque placement (ou échec) est accompagné de raisons lisibles.
 */

export interface SchedulableTask {
  id: string
  title: string
  /** Durée à planifier (minutes). */
  estimateMin: number
  /** YYYY-MM-DD ou null. */
  dueDate: string | null
  hardDeadline: boolean
  /** 0 = aucune, 1 = urgente … 4 = basse. */
  priority: number
  createdAt: string
}

export interface Interval {
  start: Date
  end: Date
}

export interface PlanOptions {
  /** Début de planification (les créneaux avant cet instant sont exclus). */
  from: Date
  /** Nombre de jours d'horizon (from inclus). */
  horizonDays: number
  /** Heures de travail locales [start, end). */
  workStartHour: number
  workEndHour: number
  /** Jours ouvrés (0=dim … 6=sam). */
  workDays: number[]
}

export const DEFAULT_PLAN_OPTIONS: Omit<PlanOptions, 'from'> = {
  horizonDays: 14,
  workStartHour: 9,
  workEndHour: 18,
  workDays: [1, 2, 3, 4, 5],
}

export interface Placement {
  taskId: string
  start: Date
  end: Date
  reasons: string[]
}

export interface PlanResult {
  placements: Placement[]
  unplaced: { taskId: string; reasons: string[] }[]
}

const MIN = 60 * 1000

function priorityLabel(p: number): string {
  return ['sans priorité', 'priorité urgente', 'priorité haute', 'priorité moyenne', 'priorité basse'][p] ?? 'sans priorité'
}

/** Tri total explicite des candidates (voir en-tête). */
export function orderTasks(tasks: SchedulableTask[]): SchedulableTask[] {
  return [...tasks].sort((a, b) => {
    if (a.hardDeadline !== b.hardDeadline) return a.hardDeadline ? -1 : 1
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate == null) return 1
      if (b.dueDate == null) return -1
      return a.dueDate < b.dueDate ? -1 : 1
    }
    const pa = a.priority === 0 ? 5 : a.priority
    const pb = b.priority === 0 ? 5 : b.priority
    if (pa !== pb) return pa - pb
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
    return a.id < b.id ? -1 : 1
  })
}

/** Créneaux libres de la fenêtre : heures de travail moins les occupations. */
export function freeSlots(busy: Interval[], opts: PlanOptions): Interval[] {
  const sortedBusy = [...busy]
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
  const slots: Interval[] = []
  for (let day = 0; day < opts.horizonDays; day++) {
    const d = new Date(opts.from.getFullYear(), opts.from.getMonth(), opts.from.getDate() + day)
    if (!opts.workDays.includes(d.getDay())) continue
    let cursor = new Date(d.getFullYear(), d.getMonth(), d.getDate(), opts.workStartHour)
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), opts.workEndHour)
    if (cursor < opts.from) cursor = new Date(opts.from)
    if (cursor >= dayEnd) continue
    for (const b of sortedBusy) {
      if (b.end <= cursor || b.start >= dayEnd) continue
      if (b.start > cursor) slots.push({ start: new Date(cursor), end: new Date(b.start) })
      if (b.end > cursor) cursor = new Date(Math.max(cursor.getTime(), b.end.getTime()))
      if (cursor >= dayEnd) break
    }
    if (cursor < dayEnd) slots.push({ start: new Date(cursor), end: dayEnd })
  }
  return slots
}

/**
 * Planifie `tasks` dans les trous laissés par `busy`. Déterministe :
 * mêmes entrées → mêmes placements.
 */
export function planTasks(tasks: SchedulableTask[], busy: Interval[], opts: PlanOptions): PlanResult {
  const ordered = orderTasks(tasks)
  let slots = freeSlots(busy, opts)
  const placements: Placement[] = []
  const unplaced: PlanResult['unplaced'] = []

  for (const task of ordered) {
    const durMs = Math.max(15, task.estimateMin) * MIN
    const why: string[] = []
    if (task.hardDeadline && task.dueDate) why.push(`échéance dure au ${task.dueDate}`)
    else if (task.dueDate) why.push(`échéance au ${task.dueDate}`)
    if (task.priority > 0) why.push(priorityLabel(task.priority))
    why.push(`durée estimée ${task.estimateMin} min`)

    const slotIdx = slots.findIndex((s) => s.end.getTime() - s.start.getTime() >= durMs)
    if (slotIdx < 0) {
      unplaced.push({
        taskId: task.id,
        reasons: [...why, `aucun créneau libre de ${task.estimateMin} min dans les ${opts.horizonDays} prochains jours`],
      })
      continue
    }
    const slot = slots[slotIdx]
    const start = new Date(slot.start)
    const end = new Date(start.getTime() + durMs)
    if (task.dueDate) {
      const due = fromDateKey(task.dueDate)
      due.setHours(23, 59, 59)
      why.push(end <= due ? 'placé avant l’échéance' : 'placé APRÈS l’échéance : aucun créneau libre avant')
    }
    why.push('premier créneau libre assez long (first-fit)')
    placements.push({ taskId: task.id, start, end, reasons: why })

    // Consomme le créneau : le reste (s'il dépasse 15 min) reste disponible
    const rest: Interval[] = []
    if (slot.end.getTime() - end.getTime() >= 15 * MIN) rest.push({ start: end, end: slot.end })
    slots = [...slots.slice(0, slotIdx), ...rest, ...slots.slice(slotIdx + 1)]
  }

  return { placements, unplaced }
}
