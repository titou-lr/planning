import { useStore } from '../../store/useStore'
import type {
  AutomationAction, AutomationCondition, AutomationRule, AutomationTriggerType,
} from '../../core/types'
import { PRIORITY_NAMES } from '../../core/taskquery'
import { IconPlus, IconTrash, IconX, IconZap } from '../icons'

/**
 * Automatisations (§6.8) : éditeur des règles génériques
 * déclencheur → conditions → actions. Le moteur est `automations.ts`.
 */

const TRIGGERS: { id: AutomationTriggerType; label: string }[] = [
  { id: 'task.created', label: 'Quand une tâche est créée' },
  { id: 'task.statusChanged', label: 'Quand le statut change' },
  { id: 'task.completed', label: 'Quand une tâche est terminée' },
  { id: 'task.dueSoon', label: 'Quand l’échéance approche (aujourd’hui/demain)' },
]

const CONDITION_FIELDS: { id: AutomationCondition['field']; label: string }[] = [
  { id: 'title', label: 'Titre' },
  { id: 'statusId', label: 'Statut' },
  { id: 'priority', label: 'Priorité' },
  { id: 'projectId', label: 'Projet' },
  { id: 'cycleId', label: 'Cycle' },
  { id: 'labelIds', label: 'Étiquettes' },
  { id: 'dueDate', label: 'Échéance' },
]

const OPS: { id: AutomationCondition['op']; label: string }[] = [
  { id: 'equals', label: '=' },
  { id: 'notEquals', label: '≠' },
  { id: 'contains', label: 'contient' },
  { id: 'isEmpty', label: 'est vide' },
  { id: 'isNotEmpty', label: 'n’est pas vide' },
]

const ACTION_TYPES: { id: AutomationAction['type']; label: string }[] = [
  { id: 'setStatus', label: 'Définir le statut' },
  { id: 'setPriority', label: 'Définir la priorité' },
  { id: 'addLabel', label: 'Ajouter l’étiquette' },
  { id: 'setProject', label: 'Déplacer dans le projet' },
  { id: 'setCycle', label: 'Affecter au cycle' },
  { id: 'setDueInDays', label: 'Échéance dans N jours' },
]

export default function AutomationsView() {
  const data = useStore((s) => s.data)

  function newRule() {
    useStore.getState().addAutomation({
      name: 'Nouvelle règle', enabled: true,
      trigger: 'task.created', conditions: [], actions: [],
    })
  }

  return (
    <div className="col" style={{ flex: 1, minHeight: 0 }}>
      <div className="view-toolbar">
        <span className="subhead">Automatisations</span>
        <span className="caption">règles déclencheur → condition → action, appliquées localement (§6.8)</span>
        <span style={{ flex: 1 }} />
        <button className="btn btn-sm btn-primary" onClick={newRule}>
          <IconPlus width={13} height={13} /> Règle
        </button>
      </div>
      {!data.automations.length ? (
        <div className="empty-state">
          <IconZap width={20} height={20} />
          <span>Aucune règle.</span>
          <span className="caption">Exemple : quand une tâche est créée, si le titre contient « bug », définir la priorité Urgente.</span>
        </div>
      ) : (
        <div className="scroll" style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.automations.map((r) => <RuleCard key={r.id} rule={r} />)}
        </div>
      )}
    </div>
  )
}

function RuleCard({ rule }: { rule: AutomationRule }) {
  const data = useStore((s) => s.data)
  const up = (patch: Partial<AutomationRule>) => useStore.getState().updateAutomation(rule.id, patch)

  function valueEditor(
    kind: 'condition' | 'action',
    fieldOrType: string,
    value: string | number | undefined,
    onChange: (v: string | number | undefined) => void
  ) {
    const isStatus = fieldOrType === 'statusId' || fieldOrType === 'setStatus'
    const isPriority = fieldOrType === 'priority' || fieldOrType === 'setPriority'
    const isProject = fieldOrType === 'projectId' || fieldOrType === 'setProject'
    const isCycle = fieldOrType === 'cycleId' || fieldOrType === 'setCycle'
    const isLabel = fieldOrType === 'labelIds' || fieldOrType === 'addLabel'
    const isDays = fieldOrType === 'setDueInDays'
    if (isStatus) {
      return (
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value || undefined)} style={{ height: 28 }}>
          <option value="">—</option>
          {[...data.statuses].sort((a, b) => a.order - b.order).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )
    }
    if (isPriority) {
      return (
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} style={{ height: 28 }}>
          <option value="">—</option>
          {[0, 1, 2, 3, 4].map((p) => <option key={p} value={p}>{PRIORITY_NAMES[p]}</option>)}
        </select>
      )
    }
    if (isProject) {
      return (
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value || undefined)} style={{ height: 28 }}>
          <option value="">—</option>
          {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name || 'Sans nom'}</option>)}
        </select>
      )
    }
    if (isCycle) {
      return (
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value || undefined)} style={{ height: 28 }}>
          <option value="">—</option>
          {data.cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )
    }
    if (isLabel) {
      return (
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value || undefined)} style={{ height: 28 }}>
          <option value="">—</option>
          {data.labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      )
    }
    if (isDays) {
      return (
        <input
          type="number" className="input mono" style={{ width: 70, height: 28 }}
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      )
    }
    return (
      <input
        className="input" style={{ width: 140, height: 28 }}
        value={String(value ?? '')} placeholder={kind === 'condition' ? 'valeur' : ''}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
    )
  }

  return (
    <div className="panel" style={{ padding: 16, opacity: rule.enabled ? 1 : 0.6 }}>
      <div className="row gap8">
        <input type="checkbox" className="todo-check" style={{ margin: 0 }} checked={rule.enabled}
          title={rule.enabled ? 'Règle active' : 'Règle désactivée'}
          onChange={(e) => up({ enabled: e.target.checked })} />
        <input className="input" style={{ flex: 1, fontWeight: 600 }} value={rule.name}
          onChange={(e) => up({ name: e.target.value })} />
        <button className="btn btn-icon btn-sm btn-danger-ghost"
          onClick={() => { if (window.confirm('Supprimer cette règle ?')) useStore.getState().deleteAutomation(rule.id) }}>
          <IconTrash width={13} height={13} />
        </button>
      </div>

      <div className="row gap8" style={{ marginTop: 10 }}>
        <span className="eyebrow" style={{ width: 110, color: 'var(--ink-tertiary)' }}>Déclencheur</span>
        <select value={rule.trigger} onChange={(e) => up({ trigger: e.target.value as AutomationTriggerType })} style={{ height: 28 }}>
          {TRIGGERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>

      <div className="col gap6" style={{ marginTop: 8 }}>
        <div className="row gap8">
          <span className="eyebrow" style={{ width: 110, color: 'var(--ink-tertiary)' }}>Conditions</span>
          <button className="btn btn-sm btn-ghost"
            onClick={() => up({ conditions: [...rule.conditions, { field: 'title', op: 'contains', value: '' }] })}>
            <IconPlus width={11} height={11} /> Condition
          </button>
          {!rule.conditions.length && <span className="caption">aucune — la règle s’applique toujours</span>}
        </div>
        {rule.conditions.map((c, i) => (
          <div key={i} className="row gap6" style={{ paddingLeft: 118 }}>
            <select value={c.field} style={{ height: 28 }}
              onChange={(e) => up({ conditions: rule.conditions.map((x, j) => j === i ? { ...x, field: e.target.value as AutomationCondition['field'], value: undefined } : x) })}>
              {CONDITION_FIELDS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <select value={c.op} style={{ height: 28 }}
              onChange={(e) => up({ conditions: rule.conditions.map((x, j) => j === i ? { ...x, op: e.target.value as AutomationCondition['op'] } : x) })}>
              {OPS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            {c.op !== 'isEmpty' && c.op !== 'isNotEmpty' && valueEditor('condition', c.field,
              typeof c.value === 'string' || typeof c.value === 'number' ? c.value : undefined,
              (v) => up({ conditions: rule.conditions.map((x, j) => (j === i ? { ...x, value: v ?? null } : x)) }))}
            <button className="btn btn-icon btn-sm btn-ghost"
              onClick={() => up({ conditions: rule.conditions.filter((_, j) => j !== i) })}>
              <IconX width={11} height={11} />
            </button>
          </div>
        ))}
      </div>

      <div className="col gap6" style={{ marginTop: 8 }}>
        <div className="row gap8">
          <span className="eyebrow" style={{ width: 110, color: 'var(--ink-tertiary)' }}>Actions</span>
          <button className="btn btn-sm btn-ghost"
            onClick={() => up({ actions: [...rule.actions, { type: 'setPriority', value: 3 }] })}>
            <IconPlus width={11} height={11} /> Action
          </button>
          {!rule.actions.length && <span className="caption" style={{ color: 'var(--warning)' }}>aucune action : la règle ne fait rien</span>}
        </div>
        {rule.actions.map((a, i) => (
          <div key={i} className="row gap6" style={{ paddingLeft: 118 }}>
            <select value={a.type} style={{ height: 28 }}
              onChange={(e) => up({ actions: rule.actions.map((x, j) => j === i ? { type: e.target.value as AutomationAction['type'], value: undefined } : x) })}>
              {ACTION_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            {valueEditor('action', a.type, a.value,
              (v) => up({ actions: rule.actions.map((x, j) => (j === i ? { ...x, value: v } : x)) }))}
            <button className="btn btn-icon btn-sm btn-ghost"
              onClick={() => up({ actions: rule.actions.filter((_, j) => j !== i) })}>
              <IconX width={11} height={11} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
