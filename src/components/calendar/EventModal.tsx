import { useStore } from '../../store/useStore'
import type { CalendarEvent, Recurrence } from '../../core/types'
import { CATEGORY_COLORS } from '../../core/types'
import { catVar, toLocalInput } from '../work/shared'
import { IconTrash, IconX } from '../icons'
import { toast } from '../Toast'

const WEEKDAYS = [
  { d: 1, label: 'L' }, { d: 2, label: 'M' }, { d: 3, label: 'M' }, { d: 4, label: 'J' },
  { d: 5, label: 'V' }, { d: 6, label: 'S' }, { d: 0, label: 'D' },
]

const REMINDERS: { v: number | null; label: string }[] = [
  { v: null, label: 'Aucun rappel' },
  { v: 0, label: 'À l’heure de début' },
  { v: 5, label: '5 min avant' },
  { v: 15, label: '15 min avant' },
  { v: 30, label: '30 min avant' },
  { v: 60, label: '1 h avant' },
  { v: 24 * 60, label: '1 jour avant' },
]

/** Édition d'un événement : dates, récurrence (§7.1), rappel (§7.3), tâche liée (§7.2). */
export default function EventModal({ event, occStart, onClose }: {
  event: CalendarEvent
  /** ISO de l'occurrence ouverte (événement récurrent) — permet d'exclure cette occurrence. */
  occStart?: string
  onClose: () => void
}) {
  const data = useStore((s) => s.data)
  const task = event.taskId ? data.tasks.find((t) => t.id === event.taskId) : undefined
  const up = (patch: Partial<CalendarEvent>) => useStore.getState().updateEvent(event.id, patch)
  const r = event.recurrence

  function setRecur(patch: Partial<Recurrence> | null) {
    if (patch === null) return up({ recurrence: null })
    const base: Recurrence = r ?? { freq: 'weekly', interval: 1 }
    up({ recurrence: { ...base, ...patch } })
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal">
        <div className="row gap8" style={{ padding: '14px 20px', borderBottom: '1px solid var(--hairline)' }}>
          <span className="title">{task ? 'Créneau de tâche' : 'Événement'}</span>
          {event.recurrence && <span className="badge badge-accent">Récurrent</span>}
          <span style={{ flex: 1 }} />
          <button
            className="btn btn-icon btn-sm btn-danger-ghost"
            title="Supprimer l'événement (toutes les occurrences)"
            onClick={() => { if (window.confirm('Supprimer cet événement ?')) { useStore.getState().deleteEvent(event.id); onClose() } }}
          >
            <IconTrash width={13} height={13} />
          </button>
          <button className="btn btn-icon btn-sm btn-ghost" onClick={onClose}><IconX width={13} height={13} /></button>
        </div>

        <div className="scroll" style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {task ? (
            <div className="row gap8">
              <span className="caption">Tâche liée :</span>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => { useStore.getState().setSelectedTask(task.id); useStore.getState().setSection('tasks'); onClose() }}
              >
                {task.title || 'Sans titre'}
              </button>
              <span className="caption">titre et état suivent la tâche</span>
            </div>
          ) : (
            <input
              className="input" style={{ fontWeight: 600 }} placeholder="Titre de l'événement"
              value={event.title} onChange={(e) => up({ title: e.target.value })} autoFocus
            />
          )}

          <div className="row gap8">
            <span className="field-label">Début</span>
            <input
              type="datetime-local" className="input" style={{ flex: 1 }}
              value={toLocalInput(event.start)}
              onChange={(e) => {
                if (!e.target.value) return
                const start = new Date(e.target.value)
                const dur = new Date(event.end).getTime() - new Date(event.start).getTime()
                up({ start: start.toISOString(), end: new Date(start.getTime() + Math.max(0, dur)).toISOString() })
              }}
            />
          </div>
          <div className="row gap8">
            <span className="field-label">Fin</span>
            <input
              type="datetime-local" className="input" style={{ flex: 1 }}
              value={toLocalInput(event.end)}
              onChange={(e) => {
                if (!e.target.value) return
                const end = new Date(e.target.value)
                if (end <= new Date(event.start)) { toast('La fin doit suivre le début'); return }
                up({ end: end.toISOString() })
              }}
            />
          </div>
          <div className="row gap8">
            <span className="field-label">Journée</span>
            <input type="checkbox" className="todo-check" style={{ margin: 0 }} checked={event.allDay} onChange={(e) => up({ allDay: e.target.checked })} />
            <span className="caption">toute la journée</span>
          </div>
          <div className="row gap8">
            <span className="field-label">Rappel</span>
            <select
              value={event.reminderMin == null ? '' : String(event.reminderMin)}
              onChange={(e) => up({ reminderMin: e.target.value === '' ? null : Number(e.target.value) })}
              style={{ flex: 1 }}
            >
              {REMINDERS.map((x) => <option key={String(x.v)} value={x.v == null ? '' : x.v}>{x.label}</option>)}
            </select>
          </div>
          <div className="row gap8">
            <span className="field-label">Couleur</span>
            <span className="row gap6">
              {CATEGORY_COLORS.map((c) => (
                <span
                  key={c} className="dot"
                  style={{
                    background: catVar(c), width: 14, height: 14, cursor: 'pointer',
                    outline: event.color === c ? '2px solid var(--primary)' : undefined, outlineOffset: 1,
                  }}
                  onClick={() => up({ color: c })}
                />
              ))}
            </span>
          </div>

          <hr className="divider" />

          {/* Récurrence (§7.1) */}
          <div className="row gap8">
            <span className="field-label">Répéter</span>
            <select
              value={r?.freq ?? ''}
              onChange={(e) => e.target.value ? setRecur({ freq: e.target.value as Recurrence['freq'] }) : setRecur(null)}
              style={{ flex: 1 }}
            >
              <option value="">Jamais</option>
              <option value="daily">Chaque jour</option>
              <option value="weekly">Chaque semaine</option>
              <option value="monthly">Chaque mois</option>
              <option value="yearly">Chaque année</option>
            </select>
          </div>
          {r && (
            <>
              <div className="row gap8">
                <span className="field-label">Intervalle</span>
                <span className="caption">toutes les</span>
                <input
                  type="number" className="input mono" style={{ width: 64 }} min={1}
                  value={r.interval}
                  onChange={(e) => setRecur({ interval: Math.max(1, Number(e.target.value) || 1) })}
                />
                <span className="caption">
                  {r.freq === 'daily' ? 'jour(s)' : r.freq === 'weekly' ? 'semaine(s)' : r.freq === 'monthly' ? 'mois' : 'année(s)'}
                </span>
              </div>
              {r.freq === 'weekly' && (
                <div className="row gap8">
                  <span className="field-label">Jours</span>
                  <span className="row gap4">
                    {WEEKDAYS.map((w) => {
                      const days = r.byWeekday?.length ? r.byWeekday : [new Date(event.start).getDay()]
                      const on = days.includes(w.d)
                      return (
                        <button
                          key={w.d}
                          className={`chip${on ? ' on' : ''}`}
                          style={{ width: 28, height: 28, padding: 0, justifyContent: 'center' }}
                          onClick={() => {
                            const next = on ? days.filter((x) => x !== w.d) : [...days, w.d]
                            if (next.length) setRecur({ byWeekday: next })
                          }}
                        >
                          {w.label}
                        </button>
                      )
                    })}
                  </span>
                </div>
              )}
              {r.freq === 'monthly' && (
                <div className="row gap8">
                  <span className="field-label">Ancrage</span>
                  <select
                    value={r.monthlyMode ?? 'day'}
                    onChange={(e) => setRecur({ monthlyMode: e.target.value as 'day' | 'lastDay' })}
                    style={{ flex: 1 }}
                    title="Le quantième est conservé sans dérive : un événement du 31 tombe le 28/29 février puis revient au 31"
                  >
                    <option value="day">Le {new Date(event.start).getDate()} du mois (clampé fin de mois)</option>
                    <option value="lastDay">Le dernier jour du mois</option>
                  </select>
                </div>
              )}
              <div className="row gap8">
                <span className="field-label">Fin</span>
                <input
                  type="date" className="input" style={{ width: 150 }}
                  title="Jusqu'au (inclus)"
                  value={r.until ?? ''}
                  onChange={(e) => setRecur({ until: e.target.value || null, count: null })}
                />
                <span className="caption">ou après</span>
                <input
                  type="number" className="input mono" style={{ width: 64 }} min={1} placeholder="∞"
                  value={r.count ?? ''}
                  onChange={(e) => setRecur({ count: e.target.value === '' ? null : Math.max(1, Number(e.target.value)), until: null })}
                />
                <span className="caption">occurrences</span>
              </div>
              {occStart && (
                <button
                  className="btn btn-sm btn-secondary"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => { useStore.getState().excludeOccurrence(event.id, occStart); toast('Occurrence supprimée'); onClose() }}
                >
                  Supprimer uniquement cette occurrence
                </button>
              )}
            </>
          )}

          <hr className="divider" />
          <textarea
            className="input" placeholder="Notes…"
            value={event.notes} onChange={(e) => up({ notes: e.target.value })}
          />
        </div>
      </div>
    </>
  )
}
