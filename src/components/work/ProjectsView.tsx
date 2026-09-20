import { useStore } from '../../store/useStore'
import type { Project } from '../../core/types'
import { projectProgress } from '../../core/analytics'
import { isProjectLate } from '../../core/alerts'
import { isClosedStatus } from '../../core/taskquery'
import { minutesByProject } from '../../core/analytics'
import { catVar, formatDateKey, formatMin } from './shared'
import { CATEGORY_COLORS } from '../../core/types'
import { toast } from '../Toast'
import { IconPlus, IconTrash, IconX, IconAlert, IconTemplate } from '../icons'

/**
 * Projets & portfolio (§6.3, §6.5) : vue agrégée (avancement, échéances,
 * alertes de retard) + détail d'un projet + templates de projet (§6.9).
 */
export default function ProjectsView() {
  const data = useStore((s) => s.data)
  const selectedProjectId = useStore((s) => s.selectedProjectId)
  const selected = data.projects.find((p) => p.id === selectedProjectId)
  const now = new Date()
  const trackedByProject = minutesByProject(data.sessions, data.tasks, now)

  return (
    <div className="row" style={{ flex: 1, minHeight: 0, alignItems: 'stretch' }}>
      <div className="col" style={{ flex: 1, minWidth: 0 }}>
        <div className="view-toolbar">
          <span className="subhead">Portfolio</span>
          <span className="caption">{data.projects.length} projets</span>
          <span style={{ flex: 1 }} />
          {data.projectTemplates.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (!e.target.value) return
                const id = useStore.getState().createProjectFromTemplate(e.target.value)
                if (id) { useStore.getState().setSelectedProject(id); toast('Projet créé depuis le template') }
              }}
              style={{ height: 28 }}
            >
              <option value="">Nouveau depuis template…</option>
              {data.projectTemplates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.tasks.length} tâches)</option>)}
            </select>
          )}
          <button
            className="btn btn-sm btn-primary"
            onClick={() => useStore.getState().setSelectedProject(useStore.getState().createProject())}
          >
            <IconPlus width={13} height={13} /> Projet
          </button>
        </div>

        {!data.projects.length ? (
          <div className="empty-state">
            <span>Aucun projet.</span>
            <span className="caption">Les projets regroupent des tâches et alimentent portfolio, roadmap et objectifs.</span>
          </div>
        ) : (
          <div className="scroll" style={{ flex: 1 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Projet</th>
                  <th style={{ width: 90 }}>État</th>
                  <th style={{ width: 190 }}>Avancement</th>
                  <th style={{ width: 100 }}>Tâches</th>
                  <th style={{ width: 110 }}>Cible</th>
                  <th style={{ width: 110 }}>Temps passé</th>
                </tr>
              </thead>
              <tbody>
                {[...data.projects].sort((a, b) => a.order - b.order).map((p) => {
                  const progress = projectProgress(p, data.tasks, data.statuses)
                  const inProject = data.tasks.filter((t) => t.projectId === p.id)
                  const done = inProject.filter((t) => isClosedStatus(data.statuses, t.statusId)).length
                  const late = isProjectLate(p, now)
                  const tracked = trackedByProject.get(p.id) ?? 0
                  return (
                    <tr
                      key={p.id}
                      onClick={() => useStore.getState().setSelectedProject(p.id)}
                      style={selectedProjectId === p.id ? { background: 'var(--surface-2)', boxShadow: 'inset 2px 0 0 var(--primary)' } : undefined}
                    >
                      <td style={{ color: 'var(--ink)' }}>
                        <span className="row gap8">
                          <span className="dot" style={{ background: catVar(p.color) }} />
                          {p.name || 'Sans nom'}
                        </span>
                      </td>
                      <td>
                        <span className="badge">{p.health === 'active' ? 'Actif' : p.health === 'paused' ? 'En pause' : 'Terminé'}</span>
                      </td>
                      <td>
                        <span className="row gap8">
                          <span className="meter" style={{ flex: 1 }}><i style={{ width: `${Math.round(progress * 100)}%` }} /></span>
                          <span className="mono caption">{Math.round(progress * 100)} %</span>
                        </span>
                      </td>
                      <td className="num">{done}/{inProject.length}</td>
                      <td>
                        <span className="row gap4">
                          {late && <IconAlert width={12} height={12} style={{ color: 'var(--danger)' }} />}
                          <span style={late ? { color: 'var(--danger)' } : undefined}>{formatDateKey(p.targetDate)}</span>
                        </span>
                      </td>
                      <td className="num">{tracked > 0 ? formatMin(tracked) : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <ProjectDetail key={selected.id} project={selected} />}
    </div>
  )
}

function ProjectDetail({ project }: { project: Project }) {
  const data = useStore((s) => s.data)
  const tasks = data.tasks.filter((t) => t.projectId === project.id)
  const up = (patch: Partial<Project>) => useStore.getState().updateProject(project.id, patch)

  return (
    <div className="detail-panel">
      <div className="row gap8" style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)' }}>
        <span className="caption mono">PROJET</span>
        <span style={{ flex: 1 }} />
        <button
          className="btn btn-sm btn-ghost"
          title="Enregistrer la structure de tâches comme template (§6.9)"
          onClick={() => {
            const name = window.prompt('Nom du template :', project.name)
            if (name?.trim()) { useStore.getState().saveProjectAsTemplate(project.id, name.trim()); toast('Template enregistré') }
          }}
        >
          <IconTemplate width={12} height={12} /> Template
        </button>
        <button
          className="btn btn-icon btn-sm btn-danger-ghost"
          title="Supprimer le projet (les tâches sont conservées, détachées)"
          onClick={() => { if (window.confirm('Supprimer ce projet ? Ses tâches seront conservées sans projet.')) useStore.getState().deleteProject(project.id) }}
        >
          <IconTrash width={13} height={13} />
        </button>
        <button className="btn btn-icon btn-sm btn-ghost" onClick={() => useStore.getState().setSelectedProject(null)}>
          <IconX width={13} height={13} />
        </button>
      </div>
      <div className="scroll" style={{ flex: 1, padding: '12px 16px' }}>
        <input
          className="input" style={{ fontSize: 15, fontWeight: 600, height: 36, marginBottom: 10 }}
          placeholder="Nom du projet" value={project.name}
          onChange={(e) => up({ name: e.target.value })}
        />
        <div className="field-row">
          <span className="field-label">État</span>
          <div className="field-value">
            <select value={project.health} onChange={(e) => up({ health: e.target.value as Project['health'] })} style={{ flex: 1 }}>
              <option value="active">Actif</option>
              <option value="paused">En pause</option>
              <option value="done">Terminé</option>
            </select>
          </div>
        </div>
        <div className="field-row">
          <span className="field-label">Couleur</span>
          <div className="field-value">
            {CATEGORY_COLORS.map((c) => (
              <span
                key={c}
                className="dot"
                style={{
                  background: catVar(c), width: 14, height: 14, cursor: 'pointer',
                  outline: project.color === c ? '2px solid var(--primary)' : undefined, outlineOffset: 1,
                }}
                onClick={() => up({ color: c })}
              />
            ))}
          </div>
        </div>
        <div className="field-row">
          <span className="field-label">Début</span>
          <div className="field-value"><input type="date" className="input" value={project.startDate ?? ''} onChange={(e) => up({ startDate: e.target.value || null })} /></div>
        </div>
        <div className="field-row">
          <span className="field-label">Cible</span>
          <div className="field-value"><input type="date" className="input" value={project.targetDate ?? ''} onChange={(e) => up({ targetDate: e.target.value || null })} /></div>
        </div>
        <div className="field-row" style={{ alignItems: 'flex-start' }}>
          <span className="field-label" style={{ paddingTop: 6 }}>Description</span>
          <div className="field-value">
            <textarea className="input" value={project.description} onChange={(e) => up({ description: e.target.value })} />
          </div>
        </div>

        <hr className="divider" style={{ margin: '10px 0' }} />
        <div className="spread">
          <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>Tâches ({tasks.length})</span>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              const id = useStore.getState().createTask({ projectId: project.id })
              useStore.getState().setSelectedTask(id)
              useStore.getState().setSection('tasks')
            }}
          >
            <IconPlus width={12} height={12} /> Tâche
          </button>
        </div>
        {tasks.map((t) => {
          const st = data.statuses.find((s) => s.id === t.statusId)
          const closed = st?.category === 'done' || st?.category === 'canceled'
          return (
            <div
              key={t.id} className="subtask-row"
              onClick={() => { useStore.getState().setSelectedTask(t.id); useStore.getState().setSection('tasks') }}
            >
              <span className="dot" style={{ background: st ? catVar(st.color) : undefined }} />
              <span style={{ flex: 1, textDecoration: closed ? 'line-through' : undefined }}>{t.title || 'Sans titre'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
