import { useStore } from '../../store/useStore'
import { goalProgress } from '../../core/analytics'
import { formatDateKey } from './shared'
import { IconPlus, IconTrash } from '../icons'

/** Objectifs OKR-like (§6.5) : progression dérivée des projets/tâches liés. */
export default function GoalsView() {
  const data = useStore((s) => s.data)

  return (
    <div className="col" style={{ flex: 1, minHeight: 0 }}>
      <div className="view-toolbar">
        <span className="subhead">Objectifs</span>
        <span className="caption">progression dérivée automatiquement des projets et tâches liés</span>
        <span style={{ flex: 1 }} />
        <button className="btn btn-sm btn-primary" onClick={() => useStore.getState().createGoal({ name: 'Nouvel objectif' })}>
          <IconPlus width={13} height={13} /> Objectif
        </button>
      </div>
      {!data.goals.length ? (
        <div className="empty-state">
          <span>Aucun objectif.</span>
          <span className="caption">Rattacher des projets ou des tâches : la progression se calcule toute seule.</span>
        </div>
      ) : (
        <div className="scroll" style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.goals.map((g) => {
            const progress = goalProgress(g, data.projects, data.tasks, data.statuses)
            return (
              <div key={g.id} className="panel" style={{ padding: 16 }}>
                <div className="row gap8">
                  <input
                    className="input" style={{ flex: 1, fontWeight: 600 }}
                    value={g.name} placeholder="Nom de l'objectif"
                    onChange={(e) => useStore.getState().updateGoal(g.id, { name: e.target.value })}
                  />
                  <span className="kpi-value" style={{ fontSize: 18 }}>{Math.round(progress * 100)} %</span>
                  <input
                    type="date" className="input" style={{ width: 140 }}
                    title="Date cible"
                    value={g.targetDate ?? ''}
                    onChange={(e) => useStore.getState().updateGoal(g.id, { targetDate: e.target.value || null })}
                  />
                  <button
                    className="btn btn-icon btn-sm btn-danger-ghost"
                    onClick={() => { if (window.confirm('Supprimer cet objectif ?')) useStore.getState().deleteGoal(g.id) }}
                  >
                    <IconTrash width={13} height={13} />
                  </button>
                </div>
                <span className="meter" style={{ margin: '12px 0' }}><i style={{ width: `${Math.round(progress * 100)}%` }} /></span>
                <div className="row gap8" style={{ flexWrap: 'wrap' }}>
                  <span className="caption" style={{ width: 70 }}>Projets :</span>
                  {data.projects.map((p) => {
                    const on = g.projectIds.includes(p.id)
                    return (
                      <span
                        key={p.id} className={`chip${on ? ' on' : ''}`} style={{ height: 22, fontSize: 11.5 }}
                        onClick={() => useStore.getState().updateGoal(g.id, {
                          projectIds: on ? g.projectIds.filter((x) => x !== p.id) : [...g.projectIds, p.id],
                        })}
                      >
                        {p.name || 'Sans nom'}
                      </span>
                    )
                  })}
                  {!data.projects.length && <span className="caption">aucun projet</span>}
                </div>
                <div className="row gap8" style={{ flexWrap: 'wrap', marginTop: 6 }}>
                  <span className="caption" style={{ width: 70 }}>Tâches :</span>
                  {g.taskIds.map((tid) => {
                    const t = data.tasks.find((x) => x.id === tid)
                    return t ? (
                      <span key={tid} className="chip on" style={{ height: 22, fontSize: 11.5 }}
                        onClick={() => useStore.getState().updateGoal(g.id, { taskIds: g.taskIds.filter((x) => x !== tid) })}
                        title="Retirer">
                        {t.title || 'Sans titre'} ×
                      </span>
                    ) : null
                  })}
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) useStore.getState().updateGoal(g.id, { taskIds: [...g.taskIds, e.target.value] })
                    }}
                    style={{ height: 24, fontSize: 12 }}
                  >
                    <option value="">Lier une tâche…</option>
                    {data.tasks.filter((t) => !g.taskIds.includes(t.id)).map((t) => (
                      <option key={t.id} value={t.id}>{t.title || 'Sans titre'}</option>
                    ))}
                  </select>
                </div>
                {g.targetDate && <div className="caption" style={{ marginTop: 8 }}>Cible : {formatDateKey(g.targetDate)}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
