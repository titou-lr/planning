import type { Page, WorkspaceData } from '../types'
import { PRIORITY_NAMES, isClosedStatus, statusById } from '../taskquery'
import { expandEvents, toDateKey } from '../recurrence'
import { computeInsights } from './insights'

/**
 * Construction du contexte en LECTURE SEULE fourni à l'assistant (§8).
 * Pur, testable, borné en taille (usage réel à plusieurs milliers de
 * notes/tâches : on tronque, on ne plante pas).
 */

const MAX_PAGES = 120
const MAX_TASKS = 150
const MAX_SNIPPET = 240

export function pageSnippet(page: Page): string {
  return page.blocks
    .map((b) => b.text)
    .filter(Boolean)
    .join(' ')
    .slice(0, MAX_SNIPPET)
}

/** Référentiel (ids → noms) pour que le modèle propose des ids valides. */
export function referenceSection(data: WorkspaceData): string {
  const lines: string[] = []
  lines.push('STATUTS (id | nom | catégorie) :')
  for (const s of [...data.statuses].sort((a, b) => a.order - b.order)) lines.push(`  ${s.id} | ${s.name} | ${s.category}`)
  if (data.labels.length) {
    lines.push('ÉTIQUETTES (id | nom) :')
    for (const l of data.labels) lines.push(`  ${l.id} | ${l.name}`)
  }
  if (data.projects.length) {
    lines.push('PROJETS (id | nom | état) :')
    for (const p of data.projects) lines.push(`  ${p.id} | ${p.name || '(sans nom)'} | ${p.health}`)
  }
  if (data.cycles.length) {
    lines.push('CYCLES (id | nom | début → fin) :')
    for (const c of data.cycles) lines.push(`  ${c.id} | ${c.name} | ${c.startDate} → ${c.endDate}`)
  }
  lines.push(`PRIORITÉS : 0=${PRIORITY_NAMES[0]}, 1=${PRIORITY_NAMES[1]}, 2=${PRIORITY_NAMES[2]}, 3=${PRIORITY_NAMES[3]}, 4=${PRIORITY_NAMES[4]}`)
  return lines.join('\n')
}

export function tasksSection(data: WorkspaceData, opts: { openOnly?: boolean } = {}): string {
  const lines: string[] = ['TÂCHES (id | titre | statut | priorité | échéance | projet) :']
  let tasks = data.tasks
  if (opts.openOnly) tasks = tasks.filter((t) => !isClosedStatus(data.statuses, t.statusId))
  for (const t of tasks.slice(0, MAX_TASKS)) {
    const st = statusById(data.statuses, t.statusId)?.name ?? '?'
    const proj = data.projects.find((p) => p.id === t.projectId)?.name ?? '—'
    lines.push(`  ${t.id} | ${t.title || '(sans titre)'} | ${st} | ${PRIORITY_NAMES[t.priority]} | ${t.dueDate ?? '—'} | ${proj}`)
  }
  if (tasks.length > MAX_TASKS) lines.push(`  … et ${tasks.length - MAX_TASKS} autres tâches (tronqué)`)
  return lines.join('\n')
}

export function pagesSection(data: WorkspaceData): string {
  const pages = data.pages.filter((p) => p.kind !== 'template')
  const lines: string[] = ['NOTES / PAGES (id | titre | extrait) :']
  for (const p of pages.slice(0, MAX_PAGES)) {
    lines.push(`  ${p.id} | ${p.title || '(sans titre)'} | ${pageSnippet(p)}`)
  }
  if (pages.length > MAX_PAGES) lines.push(`  … et ${pages.length - MAX_PAGES} autres pages (tronqué)`)
  return lines.join('\n')
}

export function calendarSection(data: WorkspaceData, now: Date): string {
  const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14)
  const occ = expandEvents(data.events, now, horizon).slice(0, 60)
  const byId = new Map(data.events.map((e) => [e.id, e]))
  const lines: string[] = [`CALENDRIER (14 prochains jours, aujourd'hui = ${toDateKey(now)}) :`]
  for (const o of occ) {
    const ev = byId.get(o.eventId)
    if (!ev) continue
    const task = ev.taskId ? data.tasks.find((t) => t.id === ev.taskId) : undefined
    lines.push(`  ${toDateKey(o.start)} ${o.start.toTimeString().slice(0, 5)}–${o.end.toTimeString().slice(0, 5)} | ${ev.title || task?.title || '(sans titre)'}${task ? ' [tâche liée]' : ''}`)
  }
  if (!occ.length) lines.push('  (aucun événement)')
  return lines.join('\n')
}

/** Contexte complet en lecture pour le chat contextuel. */
export function buildAssistantContext(data: WorkspaceData, now: Date): string {
  return [
    referenceSection(data),
    tasksSection(data),
    pagesSection(data),
    calendarSection(data, now),
    'INSIGHTS (déjà calculés par les moteurs locaux) :\n' + computeInsights(data, now).lines.map((l) => `  - ${l}`).join('\n'),
  ].join('\n\n')
}
