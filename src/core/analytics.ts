import type { Cycle, Project, Task, TaskStatus, TimeSession } from './types'
import { isDoneStatus, statusById } from './taskquery'
import { toDateKey, fromDateKey, expandEvents } from './recurrence'
import type { CalendarEvent } from './types'

/**
 * Moteurs d'analytique (§6.7, §6.5, §7.4) — purs, dérivés uniquement
 * des données locales. L'assistant IA et les rapports Recharts
 * consomment les mêmes fonctions (aucune logique dupliquée).
 */

/* ---- Vélocité par cycle ---- */

export interface CycleVelocity {
  cycleId: string
  name: string
  completed: number
  estimateMin: number
  total: number
}

export function velocityByCycle(tasks: Task[], cycles: Cycle[], statuses: TaskStatus[]): CycleVelocity[] {
  return [...cycles]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((c) => {
      const inCycle = tasks.filter((t) => t.cycleId === c.id)
      const done = inCycle.filter((t) => isDoneStatus(statuses, t.statusId))
      return {
        cycleId: c.id,
        name: c.name,
        completed: done.length,
        estimateMin: done.reduce((s, t) => s + (t.estimateMin ?? 0), 0),
        total: inCycle.length,
      }
    })
}

/* ---- Taux de complétion & temps de résolution ---- */

export interface CompletionStats {
  total: number
  done: number
  canceled: number
  rate: number
  /** Temps moyen création → complétion, en jours (null si aucune terminée). */
  avgResolutionDays: number | null
}

export function completionStats(tasks: Task[], statuses: TaskStatus[]): CompletionStats {
  const done = tasks.filter((t) => isDoneStatus(statuses, t.statusId))
  const canceled = tasks.filter((t) => statusById(statuses, t.statusId)?.category === 'canceled')
  const countable = tasks.length - canceled.length
  const durations = done
    .filter((t) => t.completedAt && t.createdAt)
    .map((t) => (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime()) / 86400000)
    .filter((d) => !isNaN(d) && d >= 0)
  return {
    total: tasks.length,
    done: done.length,
    canceled: canceled.length,
    rate: countable > 0 ? done.length / countable : 0,
    avgResolutionDays: durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null,
  }
}

/* ---- Répartitions ---- */

export interface Bucket {
  key: string
  name: string
  count: number
}

export function countByStatus(tasks: Task[], statuses: TaskStatus[]): Bucket[] {
  return [...statuses]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ key: s.id, name: s.name, count: tasks.filter((t) => t.statusId === s.id).length }))
}

export function countByPriority(tasks: Task[]): Bucket[] {
  const names = ['Aucune', 'Urgente', 'Haute', 'Moyenne', 'Basse']
  return [1, 2, 3, 4, 0].map((p) => ({
    key: String(p),
    name: names[p],
    count: tasks.filter((t) => t.priority === p).length,
  }))
}

export function countByLabel(tasks: Task[], labels: { id: string; name: string }[]): Bucket[] {
  return labels.map((l) => ({
    key: l.id,
    name: l.name,
    count: tasks.filter((t) => t.labelIds.includes(l.id)).length,
  }))
}

/* ---- Charge de travail (§6.5) ---- */

export interface DayLoad {
  /** YYYY-MM-DD. */
  date: string
  /** Minutes de créneaux calendrier (time-blocking + événements liés à des tâches). */
  plannedMin: number
  /** Minutes d'estimation des tâches DUES ce jour non planifiées en créneau. */
  dueMin: number
  taskCount: number
}

/**
 * Charge par jour sur une fenêtre : créneaux liés à des tâches +
 * estimations des tâches dues, pour repérer la surcharge (§6.5).
 */
export function workloadByDay(
  tasks: Task[],
  events: CalendarEvent[],
  statuses: TaskStatus[],
  weekStart: Date,
  days: number
): DayLoad[] {
  const rangeStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate())
  const rangeEnd = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate() + days, 0, 0, -1)
  const occ = expandEvents(events, rangeStart, rangeEnd)
  const byId = new Map(events.map((e) => [e.id, e]))
  const plannedTaskIds = new Set(
    events.filter((e) => e.taskId).map((e) => e.taskId as string)
  )

  const out: DayLoad[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate() + i)
    const key = toDateKey(d)
    let plannedMin = 0
    let taskCount = 0
    for (const o of occ) {
      if (toDateKey(o.start) !== key) continue
      const ev = byId.get(o.eventId)
      if (!ev?.taskId) continue
      plannedMin += Math.max(0, (o.end.getTime() - o.start.getTime()) / 60000)
      taskCount++
    }
    let dueMin = 0
    for (const t of tasks) {
      if (t.dueDate !== key || isDoneStatus(statuses, t.statusId)) continue
      if (statusById(statuses, t.statusId)?.category === 'canceled') continue
      if (plannedTaskIds.has(t.id)) continue
      dueMin += t.estimateMin ?? 0
      taskCount++
    }
    out.push({ date: key, plannedMin: Math.round(plannedMin), dueMin, taskCount })
  }
  return out
}

/* ---- Progression de projet / objectif ---- */

export function projectProgress(project: Project, tasks: Task[], statuses: TaskStatus[]): number {
  const inProject = tasks.filter((t) => t.projectId === project.id)
  const counted = inProject.filter((t) => statusById(statuses, t.statusId)?.category !== 'canceled')
  if (!counted.length) return 0
  return counted.filter((t) => isDoneStatus(statuses, t.statusId)).length / counted.length
}

/**
 * Progression d'un objectif : moyenne de la progression de ses projets
 * et de la complétion de ses tâches directes (dérivée, jamais saisie).
 */
export function goalProgress(
  goal: { projectIds: string[]; taskIds: string[] },
  projects: Project[],
  tasks: Task[],
  statuses: TaskStatus[]
): number {
  const parts: number[] = []
  for (const pid of goal.projectIds) {
    const p = projects.find((x) => x.id === pid)
    if (p) parts.push(projectProgress(p, tasks, statuses))
  }
  for (const tid of goal.taskIds) {
    const t = tasks.find((x) => x.id === tid)
    if (t) parts.push(isDoneStatus(statuses, t.statusId) ? 1 : 0)
  }
  if (!parts.length) return 0
  return parts.reduce((a, b) => a + b, 0) / parts.length
}

/* ---- Suivi du temps (§7.4) ---- */

export function sessionMinutes(s: TimeSession, now: Date): number {
  const start = new Date(s.start).getTime()
  const end = s.end ? new Date(s.end).getTime() : now.getTime()
  if (isNaN(start) || isNaN(end) || end <= start) return 0
  return (end - start) / 60000
}

export function minutesByTask(sessions: TimeSession[], now: Date): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of sessions) {
    m.set(s.taskId, (m.get(s.taskId) ?? 0) + sessionMinutes(s, now))
  }
  return m
}

export function minutesByProject(
  sessions: TimeSession[],
  tasks: Task[],
  now: Date
): Map<string | null, number> {
  const taskProject = new Map(tasks.map((t) => [t.id, t.projectId]))
  const m = new Map<string | null, number>()
  for (const s of sessions) {
    const pid = taskProject.get(s.taskId) ?? null
    m.set(pid, (m.get(pid) ?? 0) + sessionMinutes(s, now))
  }
  return m
}

/** Sessions dont le début tombe dans [from, to] (bornes YYYY-MM-DD incluses). */
export function sessionsInRange(sessions: TimeSession[], fromKey: string, toKey: string): TimeSession[] {
  const from = fromDateKey(fromKey)
  const to = fromDateKey(toKey)
  to.setHours(23, 59, 59)
  return sessions.filter((s) => {
    const d = new Date(s.start)
    return !isNaN(d.getTime()) && d >= from && d <= to
  })
}
