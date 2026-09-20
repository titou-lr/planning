import { useStore } from '../../store/useStore'
import type { Task } from '../../core/types'
import { PRIORITY_NAMES } from '../../core/taskquery'
import { PriorityIcon, TagChips, DueChip, formatMin, catVar } from './shared'

/** Vue liste/tableau (§6.2) : tri/filtres appliqués en amont (WorkView). */
export default function TaskList({ tasks }: { tasks: Task[] }) {
  const data = useStore((s) => s.data)
  const selectedTaskId = useStore((s) => s.selectedTaskId)
  const statuses = [...data.statuses].sort((a, b) => a.order - b.order)

  if (!tasks.length) {
    return <div className="empty-state">Aucune tâche ne correspond aux filtres.</div>
  }

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 40 }}>Prio</th>
            <th>Titre</th>
            <th style={{ width: 140 }}>Statut</th>
            <th style={{ width: 140 }}>Projet</th>
            <th style={{ width: 110 }}>Cycle</th>
            <th style={{ width: 90 }}>Échéance</th>
            <th style={{ width: 80 }}>Estim.</th>
            <th>Étiquettes</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const project = data.projects.find((p) => p.id === t.projectId)
            const cycle = data.cycles.find((c) => c.id === t.cycleId)
            return (
              <tr
                key={t.id}
                className={selectedTaskId === t.id ? 'sel' : ''}
                onClick={() => useStore.getState().setSelectedTask(t.id)}
                style={selectedTaskId === t.id ? { background: 'var(--surface-2)', boxShadow: 'inset 2px 0 0 var(--primary)' } : undefined}
              >
                <td><PriorityIcon p={t.priority} /></td>
                <td style={{ color: 'var(--ink)' }}>
                  {t.parentId && <span className="caption">↳ </span>}
                  {t.title || 'Sans titre'}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <select
                    value={t.statusId}
                    onChange={(e) => useStore.getState().updateTask(t.id, { statusId: e.target.value })}
                    style={{ height: 28, width: '100%' }}
                    title={PRIORITY_NAMES[t.priority]}
                  >
                    {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </td>
                <td>
                  {project ? (
                    <span className="row gap6">
                      <span className="dot" style={{ background: catVar(project.color) }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.name || 'Projet'}</span>
                    </span>
                  ) : <span className="caption">—</span>}
                </td>
                <td>{cycle ? cycle.name : <span className="caption">—</span>}</td>
                <td><DueChip task={t} /></td>
                <td className="num">{t.estimateMin != null ? formatMin(t.estimateMin) : ''}</td>
                <td><span className="row gap4" style={{ flexWrap: 'wrap' }}><TagChips ids={t.labelIds} labels={data.labels} max={4} /></span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
