import { useStore } from '../../store/useStore'
import { velocityByCycle } from '../../core/analytics'
import { toDateKey } from '../../core/recurrence'
import { formatDateKey, formatMin } from './shared'
import { IconPlus, IconTrash } from '../icons'

/** Cycles / sprints (§6.3) : période fixe + récapitulatif de fin de cycle. */
export default function CyclesView() {
  const data = useStore((s) => s.data)
  const todayKey = toDateKey(new Date())
  const velocity = velocityByCycle(data.tasks, data.cycles, data.statuses)
  const cycles = [...data.cycles].sort((a, b) => b.startDate.localeCompare(a.startDate))

  return (
    <div className="col" style={{ flex: 1, minHeight: 0 }}>
      <div className="view-toolbar">
        <span className="subhead">Cycles</span>
        <span className="caption">périodes fixes de travail, vélocité en fin de cycle</span>
        <span style={{ flex: 1 }} />
        <button className="btn btn-sm btn-primary" onClick={() => useStore.getState().createCycle()}>
          <IconPlus width={13} height={13} /> Cycle
        </button>
      </div>
      {!cycles.length ? (
        <div className="empty-state">
          <span>Aucun cycle.</span>
          <span className="caption">Un cycle est une période fixe (deux semaines par défaut) à laquelle rattacher des tâches.</span>
        </div>
      ) : (
        <div className="scroll" style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cycles.map((c) => {
            const v = velocity.find((x) => x.cycleId === c.id)
            const current = c.startDate <= todayKey && todayKey <= c.endDate
            const past = c.endDate < todayKey
            const open = (v?.total ?? 0) - (v?.completed ?? 0)
            return (
              <div key={c.id} className="panel" style={{ padding: 16 }}>
                <div className="row gap8">
                  <input
                    className="input" style={{ width: 200, fontWeight: 600 }}
                    value={c.name}
                    onChange={(e) => useStore.getState().updateCycle(c.id, { name: e.target.value })}
                  />
                  {current && <span className="badge badge-accent">En cours</span>}
                  {past && <span className="badge">Terminé</span>}
                  <span style={{ flex: 1 }} />
                  <input type="date" className="input" style={{ width: 140 }} value={c.startDate}
                    onChange={(e) => e.target.value && useStore.getState().updateCycle(c.id, { startDate: e.target.value })} />
                  <span className="caption">→</span>
                  <input type="date" className="input" style={{ width: 140 }} value={c.endDate}
                    onChange={(e) => e.target.value && useStore.getState().updateCycle(c.id, { endDate: e.target.value })} />
                  <button
                    className="btn btn-icon btn-sm btn-danger-ghost"
                    onClick={() => { if (window.confirm('Supprimer ce cycle ? Les tâches seront détachées.')) useStore.getState().deleteCycle(c.id) }}
                  >
                    <IconTrash width={13} height={13} />
                  </button>
                </div>
                <div className="row gap24" style={{ marginTop: 12 }}>
                  <div className="col">
                    <span className="kpi-label">Terminées</span>
                    <span className="kpi-value">{v?.completed ?? 0}<span className="caption"> / {v?.total ?? 0}</span></span>
                  </div>
                  <div className="col">
                    <span className="kpi-label">{past ? 'Non terminées' : 'Restantes'}</span>
                    <span className="kpi-value" style={past && open > 0 ? { color: 'var(--warning)' } : undefined}>{open}</span>
                  </div>
                  <div className="col">
                    <span className="kpi-label">Effort livré</span>
                    <span className="kpi-value">{formatMin(v?.estimateMin ?? 0)}</span>
                  </div>
                  <div className="col" style={{ flex: 1 }}>
                    <span className="kpi-label">Période</span>
                    <span className="small" style={{ color: 'var(--ink-muted)' }}>
                      {formatDateKey(c.startDate)} → {formatDateKey(c.endDate)}
                    </span>
                  </div>
                  <div className="col" style={{ width: 200 }}>
                    <span className="kpi-label">Complétion</span>
                    <span className="meter" style={{ marginTop: 8 }}>
                      <i style={{ width: `${v?.total ? Math.round(((v.completed) / v.total) * 100) : 0}%` }} />
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
