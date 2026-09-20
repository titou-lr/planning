import { useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import { expandEvents } from '../../core/recurrence'
import { isClosedStatus } from '../../core/taskquery'
import { DEFAULT_PLAN_OPTIONS, planTasks, type SchedulableTask } from '../../core/scheduling'
import { formatMin, timeHM } from '../work/shared'
import { IconX } from '../icons'
import { toast } from '../Toast'

/**
 * Planification assistée par contraintes (§7.6) : propositions
 * déterministes et explicables, appliquées uniquement sur confirmation
 * explicite — jamais d'écriture silencieuse.
 */
export default function PlannerModal({ onClose }: { onClose: () => void }) {
  const data = useStore((s) => s.data)
  const [horizon, setHorizon] = useState(14)
  const [workStart, setWorkStart] = useState(9)
  const [workEnd, setWorkEnd] = useState(18)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  const result = useMemo(() => {
    const now = new Date()
    const plannedIds = new Set(data.events.filter((e) => e.taskId).map((e) => e.taskId as string))
    const candidates: SchedulableTask[] = data.tasks
      .filter((t) => !isClosedStatus(data.statuses, t.statusId) && !plannedIds.has(t.id))
      .map((t) => ({
        id: t.id,
        title: t.title || 'Sans titre',
        estimateMin: t.estimateMin && t.estimateMin > 0 ? t.estimateMin : 60,
        dueDate: t.dueDate,
        hardDeadline: t.hardDeadline,
        priority: t.priority,
        createdAt: t.createdAt,
      }))
    const horizonEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + horizon, 23, 59, 59)
    const busy = expandEvents(data.events, now, horizonEnd).map((o) => ({ start: o.start, end: o.end }))
    return planTasks(candidates, busy, {
      ...DEFAULT_PLAN_OPTIONS,
      from: now,
      horizonDays: horizon,
      workStartHour: workStart,
      workEndHour: workEnd,
    })
  }, [data.tasks, data.statuses, data.events, horizon, workStart, workEnd])

  const kept = result.placements.filter((p) => !excluded.has(p.taskId))

  function confirm() {
    useStore.getState().applyPlan(kept)
    toast(`${kept.length} créneau(x) créé(s)`)
    onClose()
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" style={{ width: 640 }}>
        <div className="row gap8" style={{ padding: '14px 20px', borderBottom: '1px solid var(--hairline)' }}>
          <span className="title">Planification assistée</span>
          <span className="caption">déterministe et explicable — rien n’est écrit sans confirmation</span>
          <span style={{ flex: 1 }} />
          <button className="btn btn-icon btn-sm btn-ghost" onClick={onClose}><IconX width={13} height={13} /></button>
        </div>

        <div className="row gap8" style={{ padding: '10px 20px', borderBottom: '1px solid var(--hairline)', flexWrap: 'wrap' }}>
          <span className="caption">Horizon</span>
          <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} style={{ height: 28 }}>
            <option value={7}>7 jours</option>
            <option value={14}>14 jours</option>
            <option value={30}>30 jours</option>
          </select>
          <span className="caption">Heures de travail</span>
          <select value={workStart} onChange={(e) => setWorkStart(Number(e.target.value))} style={{ height: 28 }}>
            {[6, 7, 8, 9, 10].map((h) => <option key={h} value={h}>{h} h</option>)}
          </select>
          <span className="caption">→</span>
          <select value={workEnd} onChange={(e) => setWorkEnd(Number(e.target.value))} style={{ height: 28 }}>
            {[16, 17, 18, 19, 20, 21, 22].map((h) => <option key={h} value={h}>{h} h</option>)}
          </select>
          <span className="caption">jours ouvrés lun–ven · tri : échéance dure, échéance, priorité</span>
        </div>

        <div className="scroll" style={{ padding: '10px 20px', flex: 1 }}>
          {result.placements.length === 0 && result.unplaced.length === 0 && (
            <div className="empty-state">
              <span>Rien à planifier.</span>
              <span className="caption">Toutes les tâches ouvertes ont déjà un créneau au calendrier.</span>
            </div>
          )}
          {result.placements.map((p) => {
            const task = data.tasks.find((t) => t.id === p.taskId)
            const off = excluded.has(p.taskId)
            return (
              <div key={p.taskId} className="panel" style={{ padding: '10px 14px', marginBottom: 8, opacity: off ? 0.5 : 1 }}>
                <div className="row gap8">
                  <input
                    type="checkbox" className="todo-check" style={{ margin: 0 }}
                    checked={!off}
                    onChange={() => setExcluded((s) => {
                      const n = new Set(s)
                      if (n.has(p.taskId)) n.delete(p.taskId); else n.add(p.taskId)
                      return n
                    })}
                  />
                  <span className="subhead" style={{ flex: 1 }}>{task?.title || 'Sans titre'}</span>
                  <span className="mono small">
                    {p.start.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · {timeHM(p.start)}–{timeHM(p.end)}
                  </span>
                </div>
                <ul className="reason-list">
                  {p.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )
          })}
          {result.unplaced.length > 0 && (
            <>
              <div className="eyebrow" style={{ color: 'var(--warning)', margin: '10px 0 6px' }}>Non plaçables</div>
              {result.unplaced.map((u) => {
                const task = data.tasks.find((t) => t.id === u.taskId)
                return (
                  <div key={u.taskId} className="panel" style={{ padding: '10px 14px', marginBottom: 8 }}>
                    <span className="subhead">{task?.title || 'Sans titre'}</span>
                    <ul className="reason-list">{u.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  </div>
                )
              })}
            </>
          )}
        </div>

        <div className="row gap8" style={{ padding: '12px 20px', borderTop: '1px solid var(--hairline)' }}>
          <span className="caption">
            {kept.length} placement(s) retenu(s) · {formatMin(kept.reduce((s, p) => s + (p.end.getTime() - p.start.getTime()) / 60000, 0))}
          </span>
          <span style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={!kept.length} onClick={confirm}>
            Créer {kept.length} créneau(x)
          </button>
        </div>
      </div>
    </>
  )
}
