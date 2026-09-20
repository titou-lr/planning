import { useMemo } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useStore } from '../../store/useStore'
import {
  completionStats, countByLabel, countByPriority, countByStatus,
  minutesByProject, velocityByCycle, workloadByDay,
} from '../../core/analytics'
import { weekStartOf } from '../../core/habits'
import { fromDateKey } from '../../core/recurrence'
import { catVar, formatMin } from './shared'

/**
 * Rapports & analytique (§6.7) + charge de travail (§6.5) — tout est
 * dérivé des moteurs purs de `analytics.ts`, Recharts n'affiche que le
 * résultat. Couleurs : tokens uniquement, identité toujours doublée
 * d'un libellé (jamais la couleur seule).
 */

const AXIS = { fontSize: 11, fill: 'var(--ink-tertiary)' }
const TIP_STYLE = {
  background: 'var(--surface-3)', border: '1px solid var(--hairline-strong)',
  borderRadius: 8, fontSize: 12, color: 'var(--ink-muted)',
}

const PRIORITY_COLORS: Record<string, string> = {
  Urgente: 'var(--danger)', Haute: 'var(--warning)', Moyenne: 'var(--cat-blue)',
  Basse: 'var(--cat-teal)', Aucune: 'var(--cat-gray)',
}

const fmtCount = (suffix: string) => (v: unknown): [string, string] => [`${v} ${suffix}`.trim(), '']

export default function ReportsView() {
  const data = useStore((s) => s.data)
  const now = new Date()

  const stats = useMemo(() => completionStats(data.tasks, data.statuses), [data.tasks, data.statuses])
  const velocity = useMemo(() => velocityByCycle(data.tasks, data.cycles, data.statuses), [data.tasks, data.cycles, data.statuses])
  const byStatus = useMemo(() => countByStatus(data.tasks, data.statuses).filter((b) => b.count > 0), [data.tasks, data.statuses])
  const byPriority = useMemo(() => countByPriority(data.tasks), [data.tasks])
  const byLabel = useMemo(() => countByLabel(data.tasks, data.labels).filter((b) => b.count > 0), [data.tasks, data.labels])
  const workload = useMemo(
    () => workloadByDay(data.tasks, data.events, data.statuses, weekStartOf(now), 7),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.tasks, data.events, data.statuses]
  )
  const timeByProject = useMemo(() => {
    const m = minutesByProject(data.sessions, data.tasks, now)
    return [...m.entries()]
      .map(([pid, min]) => ({
        name: pid ? (data.projects.find((p) => p.id === pid)?.name ?? 'Projet supprimé') : 'Sans projet',
        min: Math.round(min),
      }))
      .filter((x) => x.min > 0)
      .sort((a, b) => b.min - a.min)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.sessions, data.tasks, data.projects])

  const statusColor = (key: string) => {
    const st = data.statuses.find((s) => s.id === key)
    return st ? catVar(st.color) : 'var(--cat-gray)'
  }

  if (!data.tasks.length) {
    return (
      <div className="empty-state">
        <span>Aucune donnée à analyser.</span>
        <span className="caption">Les rapports se remplissent dès que des tâches existent — vélocité, complétion, répartitions, charge.</span>
      </div>
    )
  }

  const totalWorkload = workload.reduce((s, d) => s + d.plannedMin + d.dueMin, 0)

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div className="kpi-row">
        <div className="panel kpi-tile col">
          <span className="kpi-label">Taux de complétion</span>
          <span className="kpi-value hero">{Math.round(stats.rate * 100)} %</span>
          <span className="caption">{stats.done} terminées / {stats.total - stats.canceled} comptées</span>
        </div>
        <div className="panel kpi-tile col">
          <span className="kpi-label">Temps moyen de résolution</span>
          <span className="kpi-value hero">
            {stats.avgResolutionDays != null ? `${stats.avgResolutionDays.toFixed(1)} j` : '—'}
          </span>
          <span className="caption">création → complétion</span>
        </div>
        <div className="panel kpi-tile col">
          <span className="kpi-label">Charge cette semaine</span>
          <span className="kpi-value hero">{formatMin(totalWorkload)}</span>
          <span className="caption">créneaux planifiés + échéances estimées</span>
        </div>
        <div className="panel kpi-tile col">
          <span className="kpi-label">Tâches ouvertes</span>
          <span className="kpi-value hero">{stats.total - stats.done - stats.canceled}</span>
          <span className="caption">{stats.canceled} annulées</span>
        </div>
      </div>

      <div className="report-grid">
        <div className="panel report-card">
          <span className="subhead">Vélocité par cycle</span>
          <span className="caption">tâches terminées par cycle (§6.7)</span>
          {velocity.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={velocity} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="var(--hairline-soft)" />
                <XAxis dataKey="name" tick={AXIS} axisLine={{ stroke: 'var(--hairline)' }} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: 'var(--surface-2)' }} formatter={fmtCount('terminées')} />
                <Bar dataKey="completed" name="Terminées" fill="var(--cat-blue)" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          ) : <span className="caption">Aucun cycle — en créer dans la section Cycles.</span>}
        </div>

        <div className="panel report-card">
          <span className="subhead">Répartition par statut</span>
          <span className="caption">toutes tâches</span>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={byStatus} dataKey="count" nameKey="name"
                innerRadius={52} outerRadius={78} paddingAngle={2} stroke="var(--surface-1)" strokeWidth={2}
              >
                {byStatus.map((b) => <Cell key={b.key} fill={statusColor(b.key)} />)}
              </Pie>
              <Tooltip contentStyle={TIP_STYLE} formatter={(v: unknown, n: unknown): [string, string] => [`${v}`, String(n)]} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--ink-subtle)' }} iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="panel report-card">
          <span className="subhead">Répartition par priorité</span>
          <span className="caption">couleurs sémantiques (§3.2)</span>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byPriority} layout="vertical" barCategoryGap="24%">
              <CartesianGrid horizontal={false} stroke="var(--hairline-soft)" />
              <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} height={20} />
              <YAxis type="category" dataKey="name" tick={AXIS} axisLine={{ stroke: 'var(--hairline)' }} tickLine={false} width={70} />
              <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: 'var(--surface-2)' }} formatter={fmtCount('tâches')} />
              <Bar dataKey="count" name="Tâches" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {byPriority.map((b) => <Cell key={b.key} fill={PRIORITY_COLORS[b.name] ?? 'var(--cat-gray)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {byLabel.length > 0 && (
          <div className="panel report-card">
            <span className="subhead">Répartition par étiquette</span>
            <span className="caption">tâches portant chaque étiquette</span>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byLabel} layout="vertical" barCategoryGap="24%">
                <CartesianGrid horizontal={false} stroke="var(--hairline-soft)" />
                <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} height={20} />
                <YAxis type="category" dataKey="name" tick={AXIS} axisLine={{ stroke: 'var(--hairline)' }} tickLine={false} width={90} />
                <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: 'var(--surface-2)' }} formatter={fmtCount('tâches')} />
                <Bar dataKey="count" name="Tâches" fill="var(--cat-teal)" radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="panel report-card">
          <span className="subhead">Charge de travail — semaine en cours</span>
          <span className="caption">minutes planifiées (créneaux) et dues (estimations) par jour (§6.5)</span>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={workload.map((d) => ({
              ...d,
              day: fromDateKey(d.date).toLocaleDateString('fr-FR', { weekday: 'short' }),
            }))} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="var(--hairline-soft)" />
              <XAxis dataKey="day" tick={AXIS} axisLine={{ stroke: 'var(--hairline)' }} tickLine={false} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} width={34} />
              <Tooltip
                contentStyle={TIP_STYLE} cursor={{ fill: 'var(--surface-2)' }}
                formatter={(v: unknown, name: unknown): [string, string] => [formatMin(Number(v) || 0), String(name)]}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--ink-subtle)' }} iconSize={8} />
              <Bar dataKey="plannedMin" name="Planifié" stackId="w" fill="var(--cat-blue)" maxBarSize={28} />
              <Bar dataKey="dueMin" name="Dû (non planifié)" stackId="w" fill="var(--cat-orange)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {timeByProject.length > 0 && (
          <div className="panel report-card">
            <span className="subhead">Temps suivi par projet</span>
            <span className="caption">sessions de chronomètre (§7.4)</span>
            <div className="col gap6">
              {timeByProject.map((p) => (
                <div key={p.name} className="row gap8">
                  <span className="small" style={{ width: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                  <span className="meter" style={{ flex: 1 }}>
                    <i style={{ width: `${Math.round((p.min / timeByProject[0].min) * 100)}%` }} />
                  </span>
                  <span className="mono caption" style={{ width: 60, textAlign: 'right' }}>{formatMin(p.min)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
