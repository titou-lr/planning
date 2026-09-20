import { useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import type { PropertyDef, Task } from '../../core/types'
import { blockedByMe } from '../../core/deps'
import { isClosedStatus, PRIORITY_NAMES } from '../../core/taskquery'
import { minutesByTask } from '../../core/analytics'
import { plannedMinutes } from '../../core/timeblock'
import BlockEditor from '../editor/BlockEditor'
import { PriorityIcon, catVar, formatMin } from './shared'
import { toast } from '../Toast'
import { IconPlay, IconStop, IconPlus, IconTrash, IconX, IconLink } from '../icons'
import { uid } from '../../core/id'

/** Panneau de détail d'une tâche (§6.1, §6.3) — DESIGN.md §6.10. */
export default function TaskDetail({ task }: { task: Task }) {
  const data = useStore((s) => s.data)
  const [depPick, setDepPick] = useState('')
  const [checkText, setCheckText] = useState('')

  const statuses = [...data.statuses].sort((a, b) => a.order - b.order)
  const subtasks = data.tasks.filter((t) => t.parentId === task.id)
  const blocking = blockedByMe(data.tasks, task.id)
  const runningSession = data.sessions.find((s) => s.end == null)
  const isTimerOnThis = runningSession?.taskId === task.id
  const trackedMin = useMemo(
    () => minutesByTask(data.sessions, new Date()).get(task.id) ?? 0,
    [data.sessions, task.id]
  )
  const plannedMin = plannedMinutes(data.events, task.id)

  const up = (patch: Partial<Task>, key?: string) =>
    useStore.getState().updateTask(task.id, patch, key)

  function addDep() {
    if (!depPick) return
    const ok = useStore.getState().addDependency(task.id, depPick)
    if (!ok) toast('Impossible : cette dépendance créerait un cycle')
    setDepPick('')
  }

  function addAttachment() {
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > 2 * 1024 * 1024) {
        toast('Pièce jointe limitée à 2 Mo (stockage local)')
        return
      }
      const reader = new FileReader()
      reader.onload = () =>
        up({ attachments: [...task.attachments, { id: uid(), name: file.name, src: String(reader.result) }] })
      reader.readAsDataURL(file)
    }
    input.click()
  }

  const depCandidates = data.tasks.filter(
    (t) => t.id !== task.id && !task.blockedBy.includes(t.id)
  )

  return (
    <div className="detail-panel">
      <div className="row gap8" style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)' }}>
        <span className="caption mono">TÂCHE</span>
        <span style={{ flex: 1 }} />
        {isTimerOnThis ? (
          <button className="btn btn-sm btn-secondary" onClick={() => useStore.getState().stopTimer()}>
            <IconStop width={12} height={12} /> Arrêter
          </button>
        ) : (
          <button className="btn btn-sm btn-ghost" title="Chronomètre (§7.4)" onClick={() => useStore.getState().startTimer(task.id)}>
            <IconPlay width={12} height={12} /> Chrono
          </button>
        )}
        <button
          className="btn btn-icon btn-sm btn-danger-ghost"
          title="Supprimer la tâche (et ses sous-tâches)"
          onClick={() => { if (window.confirm('Supprimer cette tâche et ses sous-tâches ?')) useStore.getState().deleteTask(task.id) }}
        >
          <IconTrash width={13} height={13} />
        </button>
        <button className="btn btn-icon btn-sm btn-ghost" onClick={() => useStore.getState().setSelectedTask(null)}>
          <IconX width={13} height={13} />
        </button>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '12px 16px' }}>
        {task.parentId && (
          <button className="btn btn-sm btn-ghost" style={{ marginBottom: 6 }} onClick={() => useStore.getState().setSelectedTask(task.parentId)}>
            ↖ Tâche parente : {data.tasks.find((t) => t.id === task.parentId)?.title || 'Sans titre'}
          </button>
        )}
        <input
          className="input"
          style={{ fontSize: 15, fontWeight: 600, height: 36, marginBottom: 10 }}
          placeholder="Titre de la tâche"
          value={task.title}
          onChange={(e) => up({ title: e.target.value }, `task-title:${task.id}`)}
        />

        <div className="field-row">
          <span className="field-label">Statut</span>
          <div className="field-value">
            <select value={task.statusId} onChange={(e) => up({ statusId: e.target.value })} style={{ flex: 1 }}>
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field-row">
          <span className="field-label">Priorité</span>
          <div className="field-value">
            <PriorityIcon p={task.priority} />
            <select value={task.priority} onChange={(e) => up({ priority: Number(e.target.value) as Task['priority'] })} style={{ flex: 1 }}>
              {[0, 1, 2, 3, 4].map((p) => <option key={p} value={p}>{PRIORITY_NAMES[p]}</option>)}
            </select>
          </div>
        </div>
        <div className="field-row">
          <span className="field-label">Projet</span>
          <div className="field-value">
            <select value={task.projectId ?? ''} onChange={(e) => up({ projectId: e.target.value || null })} style={{ flex: 1 }}>
              <option value="">Aucun</option>
              {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name || 'Sans nom'}</option>)}
            </select>
          </div>
        </div>
        <div className="field-row">
          <span className="field-label">Cycle</span>
          <div className="field-value">
            <select value={task.cycleId ?? ''} onChange={(e) => up({ cycleId: e.target.value || null })} style={{ flex: 1 }}>
              <option value="">Aucun</option>
              {data.cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field-row">
          <span className="field-label">Début</span>
          <div className="field-value">
            <input type="date" className="input" value={task.startDate ?? ''} onChange={(e) => up({ startDate: e.target.value || null })} />
          </div>
        </div>
        <div className="field-row">
          <span className="field-label">Échéance</span>
          <div className="field-value">
            <input type="date" className="input" style={{ flex: 1 }} value={task.dueDate ?? ''} onChange={(e) => up({ dueDate: e.target.value || null })} />
          </div>
        </div>
        {task.dueDate && (
          <div className="field-row">
            <span className="field-label" title="Échéance garantie (§6.6) : alerte automatique en cas de dépassement imminent ou constaté">Éch. dure</span>
            <div className="field-value">
              <input type="checkbox" className="todo-check" style={{ margin: 0 }} checked={task.hardDeadline} onChange={(e) => up({ hardDeadline: e.target.checked })} />
              <span className="caption">alerte auto avant/après dépassement</span>
            </div>
          </div>
        )}
        <div className="field-row">
          <span className="field-label">Estimation</span>
          <div className="field-value">
            <input
              type="number" className="input mono" style={{ width: 90 }} min={0} step={15}
              value={task.estimateMin ?? ''}
              placeholder="min"
              onChange={(e) => up({ estimateMin: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) }, `task-est:${task.id}`)}
            />
            <span className="caption">minutes {plannedMin > 0 && `· ${formatMin(plannedMin)} planifiées au calendrier`}</span>
          </div>
        </div>
        <div className="field-row" style={{ alignItems: 'flex-start' }}>
          <span className="field-label" style={{ paddingTop: 6 }}>Étiquettes</span>
          <div className="field-value">
            {data.labels.map((l) => {
              const on = task.labelIds.includes(l.id)
              return (
                <span
                  key={l.id}
                  className={`chip${on ? ' on' : ''}`}
                  style={{ height: 22, fontSize: 11.5 }}
                  onClick={() => up({ labelIds: on ? task.labelIds.filter((x) => x !== l.id) : [...task.labelIds, l.id] })}
                >
                  <span className="dot" style={{ background: catVar(l.color) }} />
                  {l.name}
                </span>
              )
            })}
            {!data.labels.length && <span className="caption">Créer des étiquettes dans Réglages</span>}
          </div>
        </div>

        {/* Champs personnalisés (§6.1) */}
        {data.taskFields.map((f) => (
          <CustomField key={f.id} def={f} task={task} onChange={(v) => up({ customProps: { ...task.customProps, [f.id]: v } }, `task-cf:${task.id}:${f.id}`)} />
        ))}

        {/* Suivi du temps (§7.4) */}
        {(trackedMin > 0 || isTimerOnThis) && (
          <div className="field-row">
            <span className="field-label">Temps passé</span>
            <div className="field-value">
              <span className={isTimerOnThis ? 'timer-chip' : 'mono small'}>
                {isTimerOnThis && <span className="live-dot" />}
                {formatMin(trackedMin)}
              </span>
            </div>
          </div>
        )}

        <hr className="divider" style={{ margin: '10px 0' }} />

        {/* Dépendances (§6.3) */}
        <div className="col gap4">
          <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>Dépendances</span>
          {task.blockedBy.map((id) => {
            const b = data.tasks.find((t) => t.id === id)
            if (!b) return null
            const closed = isClosedStatus(data.statuses, b.statusId)
            return (
              <div key={id} className="subtask-row" onClick={() => useStore.getState().setSelectedTask(id)}>
                <IconLink width={12} height={12} style={{ color: closed ? 'var(--success)' : 'var(--warning)' }} />
                <span style={{ flex: 1, textDecoration: closed ? 'line-through' : undefined }}>
                  Bloquée par : {b.title || 'Sans titre'}
                </span>
                <button
                  className="btn btn-icon btn-sm btn-ghost"
                  onClick={(e) => { e.stopPropagation(); useStore.getState().removeDependency(task.id, id) }}
                >
                  <IconX width={11} height={11} />
                </button>
              </div>
            )
          })}
          {blocking.map((id) => {
            const b = data.tasks.find((t) => t.id === id)
            return b ? (
              <div key={id} className="subtask-row" onClick={() => useStore.getState().setSelectedTask(id)}>
                <IconLink width={12} height={12} style={{ color: 'var(--ink-tertiary)' }} />
                <span className="caption" style={{ flex: 1 }}>Bloque : {b.title || 'Sans titre'}</span>
              </div>
            ) : null
          })}
          {depCandidates.length > 0 && (
            <div className="row gap6">
              <select value={depPick} onChange={(e) => setDepPick(e.target.value)} style={{ flex: 1, height: 28 }}>
                <option value="">Ajouter « bloquée par »…</option>
                {depCandidates.map((t) => <option key={t.id} value={t.id}>{t.title || 'Sans titre'}</option>)}
              </select>
              <button className="btn btn-sm btn-secondary" disabled={!depPick} onClick={addDep}>Ajouter</button>
            </div>
          )}
        </div>

        <hr className="divider" style={{ margin: '10px 0' }} />

        {/* Sous-tâches (§6.3) */}
        <div className="col gap4">
          <div className="spread">
            <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>Sous-tâches</span>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                const id = useStore.getState().createTask({ parentId: task.id, projectId: task.projectId, cycleId: task.cycleId })
                useStore.getState().setSelectedTask(id)
              }}
            >
              <IconPlus width={12} height={12} /> Sous-tâche
            </button>
          </div>
          {subtasks.map((st) => {
            const closed = isClosedStatus(data.statuses, st.statusId)
            const status = data.statuses.find((s) => s.id === st.statusId)
            return (
              <div key={st.id} className="subtask-row" onClick={() => useStore.getState().setSelectedTask(st.id)}>
                <span className="dot" style={{ background: status ? catVar(status.color) : undefined }} />
                <span style={{ flex: 1, textDecoration: closed ? 'line-through' : undefined }}>{st.title || 'Sans titre'}</span>
              </div>
            )
          })}
        </div>

        {/* Checklist (§6.3) */}
        <div className="col gap4" style={{ marginTop: 10 }}>
          <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>Checklist</span>
          {task.checklist.map((c) => (
            <div key={c.id} className="row gap6" style={{ minHeight: 26 }}>
              <input
                type="checkbox" className="todo-check" style={{ margin: 0 }}
                checked={c.done}
                onChange={() => up({ checklist: task.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })}
              />
              <span className="small" style={{ flex: 1, textDecoration: c.done ? 'line-through' : undefined, color: c.done ? 'var(--ink-tertiary)' : undefined }}>
                {c.text}
              </span>
              <button className="btn btn-icon btn-sm btn-ghost" onClick={() => up({ checklist: task.checklist.filter((x) => x.id !== c.id) })}>
                <IconX width={11} height={11} />
              </button>
            </div>
          ))}
          <div className="row gap6">
            <input
              className="input" style={{ height: 28 }} placeholder="Ajouter un élément…"
              value={checkText}
              onChange={(e) => setCheckText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && checkText.trim()) {
                  up({ checklist: [...task.checklist, { id: uid(), text: checkText.trim(), done: false }] })
                  setCheckText('')
                }
              }}
            />
          </div>
        </div>

        {/* Pièces jointes (§6.1) */}
        <div className="col gap4" style={{ marginTop: 10 }}>
          <div className="spread">
            <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>Pièces jointes</span>
            <button className="btn btn-sm btn-ghost" onClick={addAttachment}><IconPlus width={12} height={12} /> Joindre</button>
          </div>
          {task.attachments.map((a) => (
            <div key={a.id} className="row gap6" style={{ minHeight: 26 }}>
              <a href={a.src} download={a.name} className="small" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</a>
              <button className="btn btn-icon btn-sm btn-ghost" onClick={() => up({ attachments: task.attachments.filter((x) => x.id !== a.id) })}>
                <IconX width={11} height={11} />
              </button>
            </div>
          ))}
        </div>

        <hr className="divider" style={{ margin: '10px 0' }} />

        {/* Description riche (§6.1) — même éditeur de blocs que les notes */}
        <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>Description</span>
        <BlockEditor
          page={{ id: task.id, blocks: task.blocks }}
          onChangeBlocks={(blocks, key) => up({ blocks }, key ?? `task-desc:${task.id}`)}
        />
      </div>
    </div>
  )
}

function CustomField({ def, task, onChange }: {
  def: PropertyDef
  task: Task
  onChange: (v: string | number | boolean | null) => void
}) {
  const value = task.customProps?.[def.id] ?? null
  return (
    <div className="field-row">
      <span className="field-label" title="Champ personnalisé">{def.name}</span>
      <div className="field-value">
        {def.type === 'checkbox' ? (
          <input type="checkbox" className="todo-check" style={{ margin: 0 }} checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        ) : def.type === 'number' ? (
          <input type="number" className="input mono" value={typeof value === 'number' ? value : ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
        ) : def.type === 'date' ? (
          <input type="date" className="input" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value || null)} />
        ) : def.type === 'select' ? (
          <select value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value || null)} style={{ flex: 1 }}>
            <option value="">—</option>
            {(def.options ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        ) : (
          <input className="input" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />
        )}
      </div>
    </div>
  )
}
