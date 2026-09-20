import type { Priority, WorkspaceData } from '../types'

/**
 * Propositions d'écriture de l'assistant (§8) — même pattern que
 * `propose_life_events`/`sanitizeProposedEvents()` de Patrimoine Manager :
 * le modèle PROPOSE, la sanitisation VALIDE contre les données réelles,
 * l'utilisateur CONFIRME (carte Confirmer/Annuler), le store APPLIQUE.
 * Aucune écriture ne contourne ce chemin.
 */

export interface TaskPatchProposal {
  statusId?: string
  priority?: Priority
  labelIds?: string[]
  projectId?: string | null
  dueDate?: string | null
}

export type Proposal =
  | { kind: 'createTask'; title: string; priority: Priority; dueDate: string | null; projectId: string | null; parentId: string | null; estimateMin: number | null }
  | { kind: 'updateTask'; taskId: string; taskTitle: string; patch: TaskPatchProposal }
  | { kind: 'createEvent'; title: string; start: string; end: string }
  | { kind: 'createPage'; title: string; markdown: string }

const MAX_PROPOSALS = 20
const MAX_TITLE = 300

function str(v: unknown, max = MAX_TITLE): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
}

function dateKey(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(v + 'T00:00:00')
  return isNaN(d.getTime()) ? null : v
}

function isoDate(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function priority(v: unknown): Priority | null {
  const n = typeof v === 'number' ? v : Number(v)
  return n === 0 || n === 1 || n === 2 || n === 3 || n === 4 ? (n as Priority) : null
}

/**
 * Extrait le premier tableau/objet JSON d'une réponse de modèle
 * (tolère les fences markdown et le texte autour). Null si illisible.
 */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidates = [fenced?.[1], text]
  for (const c of candidates) {
    if (!c) continue
    const start = Math.min(...['[', '{'].map((ch) => {
      const i = c.indexOf(ch)
      return i === -1 ? Number.MAX_SAFE_INTEGER : i
    }))
    if (start === Number.MAX_SAFE_INTEGER) continue
    for (let end = c.length; end > start; end--) {
      try {
        return JSON.parse(c.slice(start, end))
      } catch {
        // essaie une coupe plus courte
      }
    }
  }
  return null
}

/**
 * Valide des propositions brutes du modèle contre les données réelles.
 * Tout id inconnu, champ mal typé ou proposition inutilisable est écarté
 * silencieusement (dégradation, jamais de crash).
 */
export function sanitizeProposals(raw: unknown, data: WorkspaceData): Proposal[] {
  const list = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' && Array.isArray((raw as { proposals?: unknown[] }).proposals))
    ? (raw as { proposals: unknown[] }).proposals
    : []
  const out: Proposal[] = []
  const statusIds = new Set(data.statuses.map((s) => s.id))
  const labelIds = new Set(data.labels.map((l) => l.id))
  const projectIds = new Set(data.projects.map((p) => p.id))
  const taskById = new Map(data.tasks.map((t) => [t.id, t]))

  for (const item of list) {
    if (out.length >= MAX_PROPOSALS) break
    if (!item || typeof item !== 'object') continue
    const p = item as Record<string, unknown>
    switch (p.kind) {
      case 'createTask': {
        const title = str(p.title)
        if (!title) break
        const parentId = typeof p.parentId === 'string' && taskById.has(p.parentId) ? p.parentId : null
        const projectId = typeof p.projectId === 'string' && projectIds.has(p.projectId) ? p.projectId : null
        const est = typeof p.estimateMin === 'number' && p.estimateMin > 0 && p.estimateMin <= 24 * 60
          ? Math.round(p.estimateMin) : null
        out.push({
          kind: 'createTask', title,
          priority: priority(p.priority) ?? 0,
          dueDate: dateKey(p.dueDate),
          projectId, parentId, estimateMin: est,
        })
        break
      }
      case 'updateTask': {
        const task = typeof p.taskId === 'string' ? taskById.get(p.taskId) : undefined
        if (!task) break
        const rawPatch = (p.patch && typeof p.patch === 'object' ? p.patch : p) as Record<string, unknown>
        const patch: TaskPatchProposal = {}
        if (typeof rawPatch.statusId === 'string' && statusIds.has(rawPatch.statusId) && rawPatch.statusId !== task.statusId)
          patch.statusId = rawPatch.statusId
        const prio = priority(rawPatch.priority)
        if (prio != null && prio !== task.priority) patch.priority = prio
        if (Array.isArray(rawPatch.labelIds)) {
          const valid = rawPatch.labelIds.filter((l): l is string => typeof l === 'string' && labelIds.has(l))
          if (valid.length) patch.labelIds = [...new Set([...task.labelIds, ...valid])]
        }
        if (rawPatch.projectId === null && task.projectId !== null) patch.projectId = null
        else if (typeof rawPatch.projectId === 'string' && projectIds.has(rawPatch.projectId) && rawPatch.projectId !== task.projectId)
          patch.projectId = rawPatch.projectId
        const due = dateKey(rawPatch.dueDate)
        if (due && due !== task.dueDate) patch.dueDate = due
        if (Object.keys(patch).length)
          out.push({ kind: 'updateTask', taskId: task.id, taskTitle: task.title || '(sans titre)', patch })
        break
      }
      case 'createEvent': {
        const title = str(p.title)
        const start = isoDate(p.start)
        const end = isoDate(p.end)
        if (!title || !start || !end || new Date(end) <= new Date(start)) break
        out.push({ kind: 'createEvent', title, start, end })
        break
      }
      case 'createPage': {
        const title = str(p.title)
        const markdown = typeof p.markdown === 'string' ? p.markdown.slice(0, 20000) : ''
        if (!title) break
        out.push({ kind: 'createPage', title, markdown })
        break
      }
    }
  }
  return out
}

/** Libellé lisible d'une proposition pour la carte Confirmer/Annuler. */
export function proposalLabel(p: Proposal, data: WorkspaceData): string {
  switch (p.kind) {
    case 'createTask': {
      const parent = p.parentId ? data.tasks.find((t) => t.id === p.parentId) : undefined
      const proj = p.projectId ? data.projects.find((x) => x.id === p.projectId) : undefined
      const parts = [`Créer la tâche « ${p.title} »`]
      if (parent) parts.push(`sous-tâche de « ${parent.title || '(sans titre)'} »`)
      if (proj) parts.push(`projet « ${proj.name} »`)
      if (p.priority) parts.push(`priorité ${['', 'urgente', 'haute', 'moyenne', 'basse'][p.priority]}`)
      if (p.dueDate) parts.push(`échéance ${p.dueDate}`)
      return parts.join(' · ')
    }
    case 'updateTask': {
      const parts: string[] = []
      if (p.patch.statusId) parts.push(`statut → ${data.statuses.find((s) => s.id === p.patch.statusId)?.name}`)
      if (p.patch.priority != null) parts.push(`priorité → ${['aucune', 'urgente', 'haute', 'moyenne', 'basse'][p.patch.priority]}`)
      if (p.patch.projectId !== undefined) parts.push(`projet → ${p.patch.projectId ? data.projects.find((x) => x.id === p.patch.projectId)?.name : 'aucun'}`)
      if (p.patch.labelIds) parts.push(`étiquettes → ${p.patch.labelIds.map((l) => data.labels.find((x) => x.id === l)?.name).filter(Boolean).join(', ')}`)
      if (p.patch.dueDate) parts.push(`échéance → ${p.patch.dueDate}`)
      return `Modifier « ${p.taskTitle} » : ${parts.join(' · ')}`
    }
    case 'createEvent':
      return `Créer l'événement « ${p.title} » du ${new Date(p.start).toLocaleString('fr-FR')} au ${new Date(p.end).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    case 'createPage':
      return `Créer la page « ${p.title} »`
  }
}
