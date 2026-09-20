import type { WorkspaceData } from '../types'
import {
  completionStats, velocityByCycle, workloadByDay, countByPriority,
  minutesByProject, projectProgress,
} from '../analytics'
import { deadlineAlerts } from '../alerts'
import { goalProgress } from '../analytics'

/**
 * Insights de l'assistant (§8) : dérivés EXCLUSIVEMENT des moteurs
 * d'analytique existants (analytics.ts, alerts.ts) — aucune logique de
 * calcul dupliquée ici, seulement de l'agrégation et de la mise en forme.
 * Pur et testable ; l'assistant IA se contente de reformuler ce résumé.
 */

export interface InsightsSummary {
  /** Lignes factuelles prêtes à afficher hors-ligne (repli sans IA). */
  lines: string[]
}

function fmtPct(x: number): string {
  return `${Math.round(x * 100)} %`
}

export function computeInsights(data: WorkspaceData, now: Date): InsightsSummary {
  const lines: string[] = []
  const { tasks, statuses, cycles, projects, goals, events, sessions } = data

  // Complétion globale (moteur §6.7)
  const stats = completionStats(tasks, statuses)
  if (stats.total > 0) {
    lines.push(
      `Tâches : ${stats.done}/${stats.total} terminées (${fmtPct(stats.rate)})` +
      (stats.avgResolutionDays != null
        ? `, résolution moyenne ${stats.avgResolutionDays.toFixed(1)} j`
        : '')
    )
  }

  // Vélocité du dernier cycle (moteur §6.7)
  const velocity = velocityByCycle(tasks, cycles, statuses)
  const lastCycle = velocity[velocity.length - 1]
  if (lastCycle && lastCycle.total > 0) {
    lines.push(`Cycle « ${lastCycle.name} » : ${lastCycle.completed}/${lastCycle.total} tâches terminées`)
  }

  // Alertes d'échéance (moteur §6.6)
  const alerts = deadlineAlerts(tasks, statuses, now)
  const overdue = alerts.filter((a) => a.kind === 'overdue')
  const imminent = alerts.filter((a) => a.kind === 'imminent')
  if (overdue.length) lines.push(`${overdue.length} tâche(s) en retard : ${overdue.slice(0, 5).map((a) => a.title || '(sans titre)').join(', ')}`)
  if (imminent.length) lines.push(`${imminent.length} échéance(s) dure(s) imminente(s) : ${imminent.slice(0, 5).map((a) => a.title || '(sans titre)').join(', ')}`)

  // Charge de la semaine (moteur §6.5)
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const load = workloadByDay(tasks, events, statuses, monday, 7)
  const totalMin = load.reduce((s, d) => s + d.plannedMin + d.dueMin, 0)
  if (totalMin > 0) {
    lines.push(`Charge cette semaine : ${(totalMin / 60).toFixed(1)} h planifiées/dues sur 7 jours`)
    const heaviest = [...load].sort((a, b) => (b.plannedMin + b.dueMin) - (a.plannedMin + a.dueMin))[0]
    if (heaviest && heaviest.plannedMin + heaviest.dueMin > 0) {
      lines.push(`Jour le plus chargé : ${heaviest.date} (${((heaviest.plannedMin + heaviest.dueMin) / 60).toFixed(1)} h)`)
    }
  }

  // Répartition par priorité (moteur §6.7)
  const prio = countByPriority(tasks.filter((t) => statuses.find((s) => s.id === t.statusId)?.category !== 'done'))
  const urgent = prio.find((b) => b.key === '1')
  if (urgent && urgent.count > 0) lines.push(`${urgent.count} tâche(s) ouvertes en priorité urgente`)

  // Projets (moteur §6.5)
  for (const p of projects.filter((x) => x.health === 'active').slice(0, 8)) {
    const prog = projectProgress(p, tasks, statuses)
    lines.push(`Projet « ${p.name || '(sans nom)'} » : ${fmtPct(prog)} d'avancement`)
  }

  // Objectifs (moteur §6.5)
  for (const g of goals.slice(0, 5)) {
    lines.push(`Objectif « ${g.name || '(sans nom)'} » : ${fmtPct(goalProgress(g, projects, tasks, statuses))}`)
  }

  // Temps suivi par projet (moteur §7.4)
  const byProject = minutesByProject(sessions, tasks, now)
  const tracked = [...byProject.entries()].reduce((s, [, m]) => s + m, 0)
  if (tracked > 0) lines.push(`Temps suivi au total : ${(tracked / 60).toFixed(1)} h`)

  if (!lines.length) lines.push('Pas encore assez de données pour produire des insights.')
  return { lines }
}
