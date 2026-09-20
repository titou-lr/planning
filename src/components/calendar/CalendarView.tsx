import { useMemo, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import type { CalendarEvent, Task } from '../../core/types'
import { expandEvents, toDateKey, type EventOccurrence } from '../../core/recurrence'
import { isClosedStatus } from '../../core/taskquery'
import { catVar, formatMin, timeHM } from '../work/shared'
import EventModal from './EventModal'
import PlannerModal from './PlannerModal'
import { IconChevron, IconPlus, IconWand } from '../icons'
import { toast } from '../Toast'

type CalMode = 'day' | 'week' | 'month'

const DOW = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const HOUR_PX = 48
const SNAP_MIN = 30

function startOfWeek(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
}

/**
 * Calendrier local (§7.1) : jour / semaine / mois, événements récurrents,
 * time-blocking par glisser-déposer depuis le tiroir des tâches (§7.2),
 * planification assistée (§7.6) via le bouton « Auto-planifier ».
 */
export default function CalendarView() {
  const data = useStore((s) => s.data)
  const [mode, setMode] = useState<CalMode>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [editing, setEditing] = useState<{ event: CalendarEvent; occStart?: string } | null>(null)
  const [plannerOpen, setPlannerOpen] = useState(false)
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)

  const now = new Date()
  const todayKey = toDateKey(now)

  // Fenêtre affichée
  const range = useMemo(() => {
    if (mode === 'day') {
      const s = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
      return { start: s, end: new Date(s.getFullYear(), s.getMonth(), s.getDate(), 23, 59, 59), days: [s] }
    }
    if (mode === 'week') {
      const s = startOfWeek(anchor)
      const days = Array.from({ length: 7 }, (_, i) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + i))
      return { start: s, end: new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6, 23, 59, 59), days }
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const gridStart = startOfWeek(first)
    const days = Array.from({ length: 42 }, (_, i) =>
      new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i))
    return { start: days[0], end: new Date(days[41].getFullYear(), days[41].getMonth(), days[41].getDate(), 23, 59, 59), days }
  }, [mode, anchor])

  const occurrences = useMemo(
    () => expandEvents(data.events, range.start, range.end),
    [data.events, range.start, range.end]
  )

  const eventById = useMemo(() => new Map(data.events.map((e) => [e.id, e])), [data.events])
  const taskById = useMemo(() => new Map(data.tasks.map((t) => [t.id, t])), [data.tasks])

  // Tâches non planifiées pour le tiroir de time-blocking
  const plannedIds = useMemo(
    () => new Set(data.events.filter((e) => e.taskId).map((e) => e.taskId as string)),
    [data.events]
  )
  const unscheduled = useMemo(
    () => data.tasks.filter((t) => !isClosedStatus(data.statuses, t.statusId) && !plannedIds.has(t.id)),
    [data.tasks, data.statuses, plannedIds]
  )

  function nav(dir: -1 | 1) {
    if (mode === 'day') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + dir))
    else if (mode === 'week') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 7 * dir))
    else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1))
  }

  function occLabel(occ: EventOccurrence): { label: string; done: boolean; taskBlock: boolean } {
    const ev = eventById.get(occ.eventId)
    const task = ev?.taskId ? taskById.get(ev.taskId) : undefined
    if (task) {
      return {
        label: ev?.title || task.title || 'Tâche', // titre dérivé de la tâche (§7.2)
        done: isClosedStatus(data.statuses, task.statusId),
        taskBlock: true,
      }
    }
    return { label: ev?.title || 'Sans titre', done: false, taskBlock: false }
  }

  function openOcc(occ: EventOccurrence) {
    const ev = eventById.get(occ.eventId)
    if (ev) setEditing({ event: ev, occStart: occ.isRecurring ? occ.start.toISOString() : undefined })
  }

  function dropTaskAt(day: Date, minutes: number) {
    if (!dragTaskId) return
    const snapped = Math.round(minutes / SNAP_MIN) * SNAP_MIN
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, snapped)
    const id = useStore.getState().scheduleTaskBlock(dragTaskId, start)
    if (id) toast('Tâche planifiée sur le créneau')
    setDragTaskId(null)
    setDragOverDay(null)
  }

  const title =
    mode === 'month'
      ? anchor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      : mode === 'week'
        ? `Semaine du ${startOfWeek(anchor).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
        : anchor.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="row" style={{ flex: 1, minHeight: 0, alignItems: 'stretch' }}>
      <div className="col" style={{ flex: 1, minWidth: 0 }}>
        <div className="view-toolbar">
          <div className="seg">
            {(['day', 'week', 'month'] as CalMode[]).map((m) => (
              <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                {m === 'day' ? 'Jour' : m === 'week' ? 'Semaine' : 'Mois'}
              </button>
            ))}
          </div>
          <button className="btn btn-icon btn-sm btn-ghost" onClick={() => nav(-1)}>
            <IconChevron style={{ transform: 'rotate(180deg)' }} />
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setAnchor(new Date())}>Aujourd’hui</button>
          <button className="btn btn-icon btn-sm btn-ghost" onClick={() => nav(1)}>
            <IconChevron />
          </button>
          <span className="subhead" style={{ textTransform: 'capitalize' }}>{title}</span>
          <span style={{ flex: 1 }} />
          <button className="btn btn-sm btn-secondary" title="Planification assistée par contraintes (§7.6) — déterministe, sur confirmation" onClick={() => setPlannerOpen(true)}>
            <IconWand width={13} height={13} /> Auto-planifier
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              const base = mode === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 9) : anchor
              const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 9, 0)
              const id = useStore.getState().createEvent({
                start: start.toISOString(),
                end: new Date(start.getTime() + 3600000).toISOString(),
              })
              const ev = useStore.getState().data.events.find((e) => e.id === id)
              if (ev) setEditing({ event: ev })
            }}
          >
            <IconPlus width={13} height={13} /> Événement
          </button>
        </div>

        {mode === 'month' ? (
          <>
            <div className="cal-dow">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
            <div className="cal-month scroll">
              {range.days.map((d) => {
                const key = toDateKey(d)
                const dayOcc = occurrences.filter((o) => toDateKey(o.start) === key)
                return (
                  <div
                    key={key}
                    className={`cal-cell${d.getMonth() !== anchor.getMonth() ? ' other' : ''}${key === todayKey ? ' today' : ''}`}
                    onClick={() => { setAnchor(d); setMode('day') }}
                  >
                    <span className="day-num">{d.getDate()}</span>
                    {dayOcc.slice(0, 3).map((o) => {
                      const { label, done } = occLabel(o)
                      const ev = eventById.get(o.eventId)
                      return (
                        <span
                          key={`${o.eventId}${o.start.toISOString()}`}
                          className={`cal-chip${done ? ' done' : ''}`}
                          style={{ borderLeftColor: ev ? catVar(ev.color) : undefined }}
                          onClick={(e) => { e.stopPropagation(); openOcc(o) }}
                          title={`${timeHM(o.start)} ${label}`}
                        >
                          {ev?.allDay ? '' : `${timeHM(o.start)} `}{label}
                        </span>
                      )
                    })}
                    {dayOcc.length > 3 && <span className="caption">+{dayOcc.length - 3}</span>}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <TimeGrid
            days={range.days}
            occurrences={occurrences}
            occLabel={occLabel}
            eventById={eventById}
            onOpen={openOcc}
            todayKey={todayKey}
            now={now}
            dragTaskId={dragTaskId}
            dragOverDay={dragOverDay}
            setDragOverDay={setDragOverDay}
            onDropTask={dropTaskAt}
          />
        )}
      </div>

      {/* Tiroir de time-blocking (§7.2) */}
      <div className="tray">
        <div className="col" style={{ padding: '12px 16px 6px' }}>
          <span className="subhead">À planifier</span>
          <span className="caption">Glisser une tâche sur la grille jour/semaine pour réserver un créneau.</span>
        </div>
        <div className="scroll" style={{ flex: 1, paddingTop: 6 }}>
          {unscheduled.length === 0 && (
            <div className="caption" style={{ padding: '8px 16px' }}>Toutes les tâches ouvertes ont un créneau.</div>
          )}
          {unscheduled.map((t) => <TrayTask key={t.id} task={t} onDragStart={() => setDragTaskId(t.id)} onDragEnd={() => { setDragTaskId(null); setDragOverDay(null) }} />)}
        </div>
      </div>

      {editing && (
        <EventModal
          event={editing.event}
          occStart={editing.occStart}
          onClose={() => setEditing(null)}
        />
      )}
      {plannerOpen && <PlannerModal onClose={() => setPlannerOpen(false)} />}
    </div>
  )
}

function TrayTask({ task, onDragStart, onDragEnd }: { task: Task; onDragStart: () => void; onDragEnd: () => void }) {
  const data = useStore((s) => s.data)
  const st = data.statuses.find((s) => s.id === task.statusId)
  return (
    <div
      className="tray-task"
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragEnd={onDragEnd}
      onClick={() => { useStore.getState().setSelectedTask(task.id); useStore.getState().setSection('tasks') }}
      title={task.title}
    >
      <span className="dot" style={{ background: st ? catVar(st.color) : undefined }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.title || 'Sans titre'}
      </span>
      <span className="caption mono">{task.estimateMin ? formatMin(task.estimateMin) : '1 h'}</span>
    </div>
  )
}

function TimeGrid({
  days, occurrences, occLabel, eventById, onOpen, todayKey, now,
  dragTaskId, dragOverDay, setDragOverDay, onDropTask,
}: {
  days: Date[]
  occurrences: EventOccurrence[]
  occLabel: (o: EventOccurrence) => { label: string; done: boolean; taskBlock: boolean }
  eventById: Map<string, CalendarEvent>
  onOpen: (o: EventOccurrence) => void
  todayKey: string
  now: Date
  dragTaskId: string | null
  dragOverDay: string | null
  setDragOverDay: (k: string | null) => void
  onDropTask: (day: Date, minutes: number) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const hours = Array.from({ length: 24 }, (_, h) => h)

  // Position de dépôt : minutes depuis minuit selon l'ordonnée du curseur
  function minutesFromPointer(e: React.DragEvent, col: HTMLElement): number {
    const rect = col.getBoundingClientRect()
    return Math.max(0, Math.min(24 * 60 - 30, ((e.clientY - rect.top) / HOUR_PX) * 60))
  }

  return (
    <div className="col" style={{ flex: 1, minHeight: 0 }}>
      <div className="cal-day-head">
        {days.map((d) => (
          <span key={toDateKey(d)} className={toDateKey(d) === todayKey ? 'today' : ''}>
            {d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
          </span>
        ))}
      </div>
      <div
        className="cal-time scroll"
        ref={(el) => {
          scrollRef.current = el
          // Ouvre sur 8 h du matin
          if (el && el.scrollTop === 0) el.scrollTop = 8 * HOUR_PX
        }}
      >
        <div className="cal-hours">
          {hours.map((h) => <div key={h}>{h > 0 ? `${String(h).padStart(2, '0')}:00` : ''}</div>)}
        </div>
        {days.map((d) => {
          const key = toDateKey(d)
          const dayOcc = occurrences.filter((o) => toDateKey(o.start) === key)
          return (
            <div
              key={key}
              className={`cal-day-col${key === todayKey ? ' today-col' : ''}${dragTaskId && dragOverDay === key ? ' drag-over' : ''}`}
              onDragOver={(e) => { if (dragTaskId) { e.preventDefault(); setDragOverDay(key) } }}
              onDragLeave={() => { if (dragOverDay === key) setDragOverDay(null) }}
              onDrop={(e) => { if (dragTaskId) onDropTask(d, minutesFromPointer(e, e.currentTarget)) }}
            >
              {hours.map((h) => <div key={h} className="cal-hour-line" />)}
              {key === todayKey && (
                <div className="cal-now" style={{ top: (now.getHours() * 60 + now.getMinutes()) * (HOUR_PX / 60) }} />
              )}
              {dayOcc.map((o) => {
                const { label, done, taskBlock } = occLabel(o)
                const ev = eventById.get(o.eventId)
                const top = (o.start.getHours() * 60 + o.start.getMinutes()) * (HOUR_PX / 60)
                const durMin = Math.max(20, (o.end.getTime() - o.start.getTime()) / 60000)
                return (
                  <div
                    key={`${o.eventId}${o.start.toISOString()}`}
                    className={`cal-block${taskBlock ? ' task-block' : ''}${done ? ' done' : ''}`}
                    style={{
                      top,
                      height: durMin * (HOUR_PX / 60) - 2,
                      borderLeftColor: ev ? catVar(ev.color) : undefined,
                    }}
                    onClick={() => onOpen(o)}
                    title={label}
                  >
                    <span className="cal-block-time">{timeHM(o.start)}–{timeHM(o.end)}</span>
                    <div>{taskBlock ? `⧉ ${label}` : label}</div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
