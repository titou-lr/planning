import type { Label, Task } from '../../core/types'
import { PRIORITY_NAMES } from '../../core/taskquery'
import { fromDateKey, toDateKey } from '../../core/recurrence'

/** Aides d'affichage partagées par les vues Tâches/Calendrier — pas de logique métier. */

export function catVar(token: string): string {
  return `var(--${token})`
}

export function PriorityIcon({ p }: { p: number }) {
  return (
    <span className={`prio p${p}`} title={PRIORITY_NAMES[p] ?? ''}>
      <i /><i /><i />
    </span>
  )
}

export function TagChips({ ids, labels, max = 3 }: { ids: string[]; labels: Label[]; max?: number }) {
  const shown = ids.slice(0, max)
  return (
    <>
      {shown.map((id) => {
        const l = labels.find((x) => x.id === id)
        if (!l) return null
        return (
          <span key={id} className="tag">
            <span className="dot" style={{ background: catVar(l.color) }} />
            {l.name}
          </span>
        )
      })}
      {ids.length > max && <span className="caption">+{ids.length - max}</span>}
    </>
  )
}

export function DueChip({ task, now = new Date() }: { task: Task; now?: Date }) {
  if (!task.dueDate) return null
  const overdue = task.dueDate < toDateKey(now)
  const d = fromDateKey(task.dueDate)
  const label = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  return (
    <span
      className={`due-chip${overdue ? ' overdue' : ''}${task.hardDeadline ? ' hard' : ''}`}
      title={task.hardDeadline ? 'Échéance dure (alerte automatique)' : 'Échéance'}
    >
      {task.hardDeadline ? '⚑ ' : ''}{label}
    </span>
  )
}

/** « 90 min » → « 1 h 30 ». */
export function formatMin(min: number): string {
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`
}

export function formatDateKey(key: string | null): string {
  if (!key) return '—'
  return fromDateKey(key).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function timeHM(d: Date): string {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** Valeur pour <input type="datetime-local"> depuis un ISO. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
