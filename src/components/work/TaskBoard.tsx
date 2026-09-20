import { useState } from 'react'
import { useStore } from '../../store/useStore'
import type { Task } from '../../core/types'
import { isBlocked } from '../../core/deps'
import { isClosedStatus } from '../../core/taskquery'
import { PriorityIcon, TagChips, DueChip, catVar } from './shared'
import { IconPlus, IconAlert } from '../icons'

/** Kanban : colonnes = statuts du workflow (§6.2), drag-and-drop natif. */
export default function TaskBoard({ tasks }: { tasks: Task[] }) {
  const data = useStore((s) => s.data)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)

  const statuses = [...data.statuses].sort((a, b) => a.order - b.order)

  function dropOn(statusId: string) {
    if (dragId) useStore.getState().updateTask(dragId, { statusId })
    setDragId(null)
    setOverCol(null)
  }

  return (
    <div className="kanban scroll" style={{ flex: 1, overflowY: 'auto' }}>
      {statuses.map((st) => {
        const colTasks = tasks.filter((t) => t.statusId === st.id)
        return (
          <div
            key={st.id}
            className="kanban-col"
            onDragOver={(e) => { e.preventDefault(); setOverCol(st.id) }}
            onDragLeave={() => setOverCol((c) => (c === st.id ? null : c))}
            onDrop={() => dropOn(st.id)}
            style={overCol === st.id ? { outline: '1px dashed var(--primary)', outlineOffset: 4, borderRadius: 8 } : undefined}
          >
            <div className="kanban-col-head">
              <span className="dot" style={{ background: catVar(st.color) }} />
              <span className="subhead">{st.name}</span>
              <span className="caption">{colTasks.length}</span>
              <span style={{ flex: 1 }} />
              <button
                className="btn btn-icon btn-sm btn-ghost"
                title={`Nouvelle tâche « ${st.name} »`}
                onClick={() => {
                  const id = useStore.getState().createTask({ statusId: st.id })
                  useStore.getState().setSelectedTask(id)
                }}
              >
                <IconPlus width={13} height={13} />
              </button>
            </div>
            {colTasks.map((t) => {
              const project = data.projects.find((p) => p.id === t.projectId)
              const blocked = !isClosedStatus(data.statuses, t.statusId) &&
                isBlocked(data.tasks, t.id, (sid) => isClosedStatus(data.statuses, sid))
              const subCount = data.tasks.filter((x) => x.parentId === t.id).length
              return (
                <div
                  key={t.id}
                  className="kcard"
                  draggable
                  onDragStart={() => setDragId(t.id)}
                  onDragEnd={() => { setDragId(null); setOverCol(null) }}
                  onClick={() => useStore.getState().setSelectedTask(t.id)}
                >
                  <div className="row gap6">
                    <PriorityIcon p={t.priority} />
                    <span className="kcard-title" style={{ flex: 1 }}>{t.title || 'Sans titre'}</span>
                  </div>
                  <div className="kcard-meta">
                    {project && (
                      <span className="caption row gap4">
                        <span className="dot" style={{ background: catVar(project.color) }} />
                        {project.name || 'Projet'}
                      </span>
                    )}
                    <DueChip task={t} />
                    {blocked && (
                      <span className="blocked-chip" title="Bloquée par une dépendance non terminée">
                        <IconAlert width={11} height={11} /> bloquée
                      </span>
                    )}
                    {subCount > 0 && (
                      <span className="caption">
                        {data.tasks.filter((x) => x.parentId === t.id && isClosedStatus(data.statuses, x.statusId)).length}/{subCount} sous-tâches
                      </span>
                    )}
                    <TagChips ids={t.labelIds} labels={data.labels} />
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
