import { useStore } from '../../store/useStore'
import type { Task } from '../../core/types'
import { fromDateKey, toDateKey } from '../../core/recurrence'
import { projectProgress } from '../../core/analytics'
import { catVar } from './shared'

const DAY_MS = 86400000

/**
 * Roadmap / timeline (§6.2) : Gantt simplifié — barres de projets
 * (début → cible, progression dérivée) et barres des tâches datées,
 * groupées par projet. Sans gestion de ressources (§6.2).
 */
export default function TaskRoadmap({ tasks }: { tasks: Task[] }) {
  const data = useStore((s) => s.data)

  // Fenêtre temporelle : englobe toutes les dates connues, ±2 semaines
  const dates: string[] = []
  for (const p of data.projects) {
    if (p.startDate) dates.push(p.startDate)
    if (p.targetDate) dates.push(p.targetDate)
  }
  for (const t of tasks) {
    if (t.startDate) dates.push(t.startDate)
    if (t.dueDate) dates.push(t.dueDate)
  }
  const today = new Date()
  const todayKey = toDateKey(today)
  dates.push(todayKey)
  const min = fromDateKey(dates.reduce((a, b) => (a < b ? a : b)))
  const max = fromDateKey(dates.reduce((a, b) => (a > b ? a : b)))
  const start = new Date(min.getFullYear(), min.getMonth(), min.getDate() - 14)
  const end = new Date(max.getFullYear(), max.getMonth(), max.getDate() + 14)
  const totalDays = Math.max(28, Math.round((end.getTime() - start.getTime()) / DAY_MS))
  const pxPerDay = Math.max(4, Math.min(24, 960 / totalDays))
  const width = totalDays * pxPerDay

  const x = (key: string) =>
    ((fromDateKey(key).getTime() - start.getTime()) / DAY_MS) * pxPerDay

  // Graduations : une par semaine (lundi)
  const ticks: Date[] = []
  const firstMonday = new Date(start)
  firstMonday.setDate(firstMonday.getDate() + ((8 - firstMonday.getDay()) % 7))
  for (let d = new Date(firstMonday); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) {
    ticks.push(new Date(d))
  }

  const rows: { kind: 'project' | 'task'; id: string; label: string; from: string; to: string; color: string; progress?: number }[] = []
  const orphanTasks: Task[] = []
  for (const p of [...data.projects].sort((a, b) => a.order - b.order)) {
    if (p.startDate || p.targetDate) {
      rows.push({
        kind: 'project', id: p.id, label: p.name || 'Projet',
        from: p.startDate ?? p.targetDate!, to: p.targetDate ?? p.startDate!,
        color: p.color, progress: projectProgress(p, data.tasks, data.statuses),
      })
    }
    for (const t of tasks.filter((t) => t.projectId === p.id)) {
      if (t.startDate || t.dueDate) {
        rows.push({
          kind: 'task', id: t.id, label: t.title || 'Sans titre',
          from: t.startDate ?? t.dueDate!, to: t.dueDate ?? t.startDate!, color: 'cat-gray',
        })
      }
    }
  }
  for (const t of tasks.filter((t) => !t.projectId && (t.startDate || t.dueDate))) orphanTasks.push(t)
  for (const t of orphanTasks) {
    rows.push({
      kind: 'task', id: t.id, label: t.title || 'Sans titre',
      from: t.startDate ?? t.dueDate!, to: t.dueDate ?? t.startDate!, color: 'cat-gray',
    })
  }

  if (!rows.length) {
    return (
      <div className="empty-state">
        <span>La roadmap affiche les projets et tâches datés.</span>
        <span className="caption">Renseigner une date de début / cible sur un projet, ou début / échéance sur une tâche.</span>
      </div>
    )
  }

  return (
    <div className="roadmap scroll" style={{ flex: 1 }}>
      <div className="roadmap-grid" style={{ width }}>
        <div className="roadmap-axis">
          {ticks.map((t, i) => {
            const left = ((t.getTime() - start.getTime()) / DAY_MS) * pxPerDay
            const w = i + 1 < ticks.length
              ? ((ticks[i + 1].getTime() - t.getTime()) / DAY_MS) * pxPerDay
              : 7 * pxPerDay
            return (
              <span key={t.toISOString()} style={{ position: 'absolute', left, width: w }}>
                {t.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            )
          })}
        </div>
        <div style={{ position: 'relative' }}>
          <div className="roadmap-today" style={{ left: x(todayKey) }} />
          {rows.map((r) => {
            const left = x(r.from)
            const w = Math.max(pxPerDay, x(r.to) - left + pxPerDay)
            return (
              <div key={`${r.kind}:${r.id}`} className="roadmap-row">
                <div
                  className="roadmap-bar"
                  style={{
                    left, width: w,
                    borderLeft: `2px solid ${catVar(r.color)}`,
                    ...(r.kind === 'project' ? { background: 'var(--surface-2)', fontWeight: 600, color: 'var(--ink)' } : {}),
                  }}
                  onClick={() =>
                    r.kind === 'task'
                      ? useStore.getState().setSelectedTask(r.id)
                      : (useStore.getState().setSelectedProject(r.id), useStore.getState().setSection('projects'))
                  }
                  title={r.kind === 'project' && r.progress != null ? `${r.label} — ${Math.round(r.progress * 100)} %` : r.label}
                >
                  {r.kind === 'project' && r.progress != null && (
                    <span className="fill" style={{ width: `${Math.round(r.progress * 100)}%` }} />
                  )}
                  {r.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
