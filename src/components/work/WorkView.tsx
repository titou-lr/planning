import { useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import type { TaskFilter, TaskSort, TaskViewType } from '../../core/types'
import { applyView, PRIORITY_NAMES } from '../../core/taskquery'
import { findCycles } from '../../core/deps'
import TaskBoard from './TaskBoard'
import TaskList from './TaskList'
import TaskDueCalendar from './TaskDueCalendar'
import TaskRoadmap from './TaskRoadmap'
import TaskDetail from './TaskDetail'
import { IconKanban, IconList, IconCalendar, IconRoadmap, IconPlus, IconX } from '../icons'
import { toast } from '../Toast'

/**
 * Module Tâches (§6.2, §6.4) : vues kanban / liste / calendrier /
 * roadmap sur le même jeu filtré+trié, filtres/tris combinables,
 * vues personnalisées sauvegardées, panneau de détail.
 */
export default function WorkView() {
  const data = useStore((s) => s.data)
  const selectedTaskId = useStore((s) => s.selectedTaskId)
  const [viewType, setViewType] = useState<TaskViewType>('kanban')
  const [filters, setFilters] = useState<TaskFilter[]>([])
  const [sorts, setSorts] = useState<TaskSort[]>([])
  const [activeSavedId, setActiveSavedId] = useState<string>('')

  const tasks = useMemo(
    () => applyView(data.tasks, filters, sorts),
    [data.tasks, filters, sorts]
  )
  const selectedTask = data.tasks.find((t) => t.id === selectedTaskId)
  // Signalement des dépendances circulaires (§6.3) — ne peut arriver que
  // par import de données, la création en cycle est refusée à la source.
  const cycles = useMemo(() => findCycles(data.tasks), [data.tasks])

  function setFilter(field: TaskFilter['field'], value: string) {
    setActiveSavedId('')
    setFilters((fs) => {
      const rest = fs.filter((f) => f.field !== field)
      if (!value) return rest
      const parsed = field === 'priority' ? Number(value) : value
      return [...rest, { field, op: 'equals', value: parsed }]
    })
  }

  function filterValue(field: TaskFilter['field']): string {
    const f = filters.find((x) => x.field === field)
    return f?.value != null ? String(f.value) : ''
  }

  function applySaved(id: string) {
    setActiveSavedId(id)
    const v = data.savedTaskViews.find((x) => x.id === id)
    if (!v) return
    setViewType(v.view)
    setFilters(v.filters)
    setSorts(v.sorts)
  }

  function saveCurrentView() {
    const name = window.prompt('Nom de la vue :')
    if (!name?.trim()) return
    const id = useStore.getState().saveTaskView({ name: name.trim(), view: viewType, filters, sorts })
    setActiveSavedId(id)
    toast('Vue enregistrée')
  }

  function newTask() {
    // La nouvelle tâche hérite des filtres actifs projet/cycle (contexte courant)
    const patch: Record<string, unknown> = {}
    const p = filters.find((f) => f.field === 'projectId')
    const c = filters.find((f) => f.field === 'cycleId')
    if (typeof p?.value === 'string') patch.projectId = p.value
    if (typeof c?.value === 'string') patch.cycleId = c.value
    const id = useStore.getState().createTask(patch)
    useStore.getState().setSelectedTask(id)
  }

  const viewButtons: { type: TaskViewType; label: string; icon: React.ReactNode }[] = [
    { type: 'list', label: 'Liste', icon: <IconList width={13} height={13} /> },
    { type: 'kanban', label: 'Kanban', icon: <IconKanban width={13} height={13} /> },
    { type: 'calendar', label: 'Calendrier', icon: <IconCalendar width={13} height={13} /> },
    { type: 'roadmap', label: 'Roadmap', icon: <IconRoadmap width={13} height={13} /> },
  ]

  return (
    <div className="row" style={{ flex: 1, minHeight: 0, alignItems: 'stretch' }}>
      <div className="col" style={{ flex: 1, minWidth: 0 }}>
        <div className="view-toolbar">
          <div className="seg">
            {viewButtons.map((v) => (
              <button
                key={v.type}
                className={viewType === v.type ? 'on' : ''}
                onClick={() => { setViewType(v.type); setActiveSavedId('') }}
              >
                <span className="row gap4">{v.icon}{v.label}</span>
              </button>
            ))}
          </div>

          <select value={filterValue('statusId')} onChange={(e) => setFilter('statusId', e.target.value)} style={{ height: 28 }}>
            <option value="">Statut : tous</option>
            {[...data.statuses].sort((a, b) => a.order - b.order).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select value={filterValue('priority')} onChange={(e) => setFilter('priority', e.target.value)} style={{ height: 28 }}>
            <option value="">Priorité : toutes</option>
            {[1, 2, 3, 4, 0].map((p) => <option key={p} value={p}>{PRIORITY_NAMES[p]}</option>)}
          </select>
          <select value={filterValue('projectId')} onChange={(e) => setFilter('projectId', e.target.value)} style={{ height: 28 }}>
            <option value="">Projet : tous</option>
            {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name || 'Sans nom'}</option>)}
          </select>
          <select value={filterValue('cycleId')} onChange={(e) => setFilter('cycleId', e.target.value)} style={{ height: 28 }}>
            <option value="">Cycle : tous</option>
            {data.cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterValue('labelIds')} onChange={(e) => setFilter('labelIds', e.target.value)} style={{ height: 28 }}>
            <option value="">Étiquette : toutes</option>
            {data.labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select
            value={sorts[0] ? `${sorts[0].field}:${sorts[0].dir}` : ''}
            onChange={(e) => {
              setActiveSavedId('')
              if (!e.target.value) return setSorts([])
              const [field, dir] = e.target.value.split(':')
              setSorts([{ field: field as TaskSort['field'], dir: dir as 'asc' | 'desc' }])
            }}
            style={{ height: 28 }}
          >
            <option value="">Tri : manuel</option>
            <option value="priority:asc">Priorité</option>
            <option value="dueDate:asc">Échéance</option>
            <option value="createdAt:desc">Plus récentes</option>
            <option value="updatedAt:desc">Modifiées récemment</option>
            <option value="estimateMin:desc">Estimation</option>
            <option value="title:asc">Titre A→Z</option>
          </select>
          {(filters.length > 0 || sorts.length > 0) && (
            <button className="btn btn-sm btn-ghost" onClick={() => { setFilters([]); setSorts([]); setActiveSavedId('') }}>
              <IconX width={12} height={12} /> Réinitialiser
            </button>
          )}

          <span style={{ flex: 1 }} />

          {data.savedTaskViews.length > 0 && (
            <select value={activeSavedId} onChange={(e) => applySaved(e.target.value)} style={{ height: 28 }}>
              <option value="">Vues enregistrées…</option>
              {data.savedTaskViews.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          )}
          {activeSavedId ? (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => { useStore.getState().deleteTaskView(activeSavedId); setActiveSavedId(''); toast('Vue supprimée') }}
            >
              Supprimer la vue
            </button>
          ) : (
            <button className="btn btn-sm btn-secondary" onClick={saveCurrentView}>Enregistrer la vue</button>
          )}
          <button className="btn btn-sm btn-primary" onClick={newTask}>
            <IconPlus width={13} height={13} /> Tâche
          </button>
        </div>

        {cycles.length > 0 && (
          <div className="row gap8" style={{ padding: '8px 16px', borderBottom: '1px solid var(--hairline)', color: 'var(--warning)', fontSize: 12.5 }}>
            ⚠ Dépendances circulaires détectées ({cycles.length}) : {cycles
              .map((c) => c.map((id) => data.tasks.find((t) => t.id === id)?.title || 'Sans titre').join(' → '))
              .join(' · ')}
            — retirer une dépendance pour débloquer ces tâches.
          </div>
        )}
        {viewType === 'kanban' && <TaskBoard tasks={tasks} />}
        {viewType === 'list' && <TaskList tasks={tasks} />}
        {viewType === 'calendar' && <TaskDueCalendar tasks={tasks} />}
        {viewType === 'roadmap' && <TaskRoadmap tasks={tasks} />}
      </div>

      {selectedTask && <TaskDetail key={selectedTask.id} task={selectedTask} />}
    </div>
  )
}
