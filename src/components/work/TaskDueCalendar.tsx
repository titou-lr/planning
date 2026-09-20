import { useState } from 'react'
import { useStore } from '../../store/useStore'
import type { Task } from '../../core/types'
import { toDateKey } from '../../core/recurrence'
import { isClosedStatus } from '../../core/taskquery'
import { catVar } from './shared'
import { IconChevron } from '../icons'

const DOW = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

/** Vue calendrier des tâches (§6.2) : les tâches sont posées sur leur échéance. */
export default function TaskDueCalendar({ tasks }: { tasks: Task[] }) {
  const data = useStore((s) => s.data)
  const [month, setMonth] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [dragId, setDragId] = useState<string | null>(null)

  const todayKey = toDateKey(new Date())
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7 // lundi = 0
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - offset)
  const cells: Date[] = []
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i))
  }

  return (
    <div className="col" style={{ flex: 1, minHeight: 0 }}>
      <div className="row gap8" style={{ padding: '8px 16px' }}>
        <button className="btn btn-icon btn-sm btn-ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          <IconChevron style={{ transform: 'rotate(180deg)' }} />
        </button>
        <button className="btn btn-icon btn-sm btn-ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          <IconChevron />
        </button>
        <span className="title" style={{ textTransform: 'capitalize' }}>
          {month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </span>
        <span className="caption">Glisser une tâche sur un jour pour changer son échéance</span>
      </div>
      <div className="cal-dow">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
      <div className="cal-month scroll">
        {cells.map((d) => {
          const key = toDateKey(d)
          const dayTasks = tasks.filter((t) => t.dueDate === key)
          const other = d.getMonth() !== month.getMonth()
          return (
            <div
              key={key}
              className={`cal-cell${other ? ' other' : ''}${key === todayKey ? ' today' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragId) useStore.getState().updateTask(dragId, { dueDate: key }) }}
            >
              <span className="day-num">{d.getDate()}</span>
              {dayTasks.slice(0, 4).map((t) => {
                const st = data.statuses.find((s) => s.id === t.statusId)
                return (
                  <span
                    key={t.id}
                    className={`cal-chip${isClosedStatus(data.statuses, t.statusId) ? ' done' : ''}`}
                    style={{ borderLeftColor: st ? catVar(st.color) : undefined }}
                    draggable
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={(e) => { e.stopPropagation(); useStore.getState().setSelectedTask(t.id) }}
                    title={t.title}
                  >
                    {t.title || 'Sans titre'}
                  </span>
                )
              })}
              {dayTasks.length > 4 && <span className="caption">+{dayTasks.length - 4}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
