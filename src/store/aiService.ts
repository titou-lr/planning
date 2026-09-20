import Anthropic from '@anthropic-ai/sdk'
import type { WorkspaceData } from '../core/types'
import { buildAssistantContext, pagesSection, referenceSection, tasksSection } from '../core/ai/context'
import { computeInsights } from '../core/ai/insights'
import { extractJson, sanitizeProposals, type Proposal } from '../core/ai/proposals'
import { getAiSettings } from './aiSettings'

/**
 * Couche d'appel au modèle (§8). Seule dépendance réseau tolérée de
 * l'app ; tout échec (pas de clé, hors-ligne, erreur API) retourne un
 * résultat `ok: false` — dégradation silencieuse, jamais de crash.
 * Ce module ne modifie JAMAIS les données : il produit du texte et des
 * propositions ; l'application passe par les cartes Confirmer/Annuler.
 */

const MODEL = 'claude-opus-4-8'

export type AiResult<T> = { ok: true; value: T } | { ok: false; error: string }

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
}

function client(): Anthropic | null {
  const { apiKey } = getAiSettings()
  if (!apiKey) return null
  // Renderer Electron : appel direct navigateur, clé locale à l'utilisateur
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

async function ask(system: string, turns: ChatTurn[], maxTokens = 4096): Promise<AiResult<string>> {
  const c = client()
  if (!c) return { ok: false, error: 'Aucune clé API configurée (Réglages → Assistant IA).' }
  try {
    const message = await c.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      system,
      messages: turns.map((t) => ({ role: t.role, content: t.text })),
    })
    const text = textOf(message)
    if (!text) return { ok: false, error: 'Réponse vide du modèle.' }
    return { ok: true, value: text }
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: 'Clé API invalide.' }
    if (e instanceof Anthropic.RateLimitError) return { ok: false, error: 'Limite de débit atteinte — réessaie dans un instant.' }
    if (e instanceof Anthropic.APIConnectionError) return { ok: false, error: 'Hors-ligne ou API injoignable — l’app reste pleinement utilisable sans IA.' }
    if (e instanceof Anthropic.APIError) return { ok: false, error: `Erreur API (${e.status ?? '?'}).` }
    return { ok: false, error: 'Erreur inattendue lors de l’appel au modèle.' }
  }
}

const BASE_SYSTEM = `Tu es l'assistant intégré d'une suite de productivité locale (notes, tâches, calendrier).
Tu as un accès en LECTURE aux données ci-dessous. Tu ne peux RIEN écrire directement :
toute modification passe par des propositions que l'utilisateur confirme ou annule.
Réponds en français, de façon concise et concrète. Ne prétends jamais avoir modifié quoi que ce soit.`

/** Chat contextuel sur les données de l'app. */
export function chat(data: WorkspaceData, turns: ChatTurn[], now = new Date()): Promise<AiResult<string>> {
  const system = `${BASE_SYSTEM}\n\n=== DONNÉES DE L'UTILISATEUR ===\n${buildAssistantContext(data, now)}`
  return ask(system, turns)
}

/** Résumé automatique d'un texte (note longue ou lot de tâches). */
export function summarize(subject: string, content: string): Promise<AiResult<string>> {
  return ask(
    `${BASE_SYSTEM}\nTa tâche : produire un résumé fidèle, structuré en points clés, du contenu fourni. Pas d'invention.`,
    [{ role: 'user', text: `Résume ${subject} :\n\n${content.slice(0, 60000)}` }]
  )
}

const PROPOSAL_FORMAT = `Réponds UNIQUEMENT avec un tableau JSON de propositions, sans texte autour. Formats admis :
{"kind":"createTask","title":"…","priority":0-4,"dueDate":"YYYY-MM-DD"|null,"projectId":id|null,"parentId":id|null,"estimateMin":minutes|null}
{"kind":"updateTask","taskId":"…","patch":{"statusId":id,"priority":0-4,"labelIds":[ids],"projectId":id|null,"dueDate":"YYYY-MM-DD"}}
{"kind":"createEvent","title":"…","start":"ISO","end":"ISO"}
{"kind":"createPage","title":"…","markdown":"…"}
N'utilise que des ids présents dans le référentiel. Tableau vide [] si rien à proposer.`

async function askProposals(data: WorkspaceData, system: string, prompt: string): Promise<AiResult<Proposal[]>> {
  const r = await ask(system, [{ role: 'user', text: prompt }])
  if (!r.ok) return r
  const proposals = sanitizeProposals(extractJson(r.value), data)
  return { ok: true, value: proposals }
}

/** Génération de sous-tâches à partir d'une tâche existante (§8). */
export function proposeSubtasks(data: WorkspaceData, taskId: string): Promise<AiResult<Proposal[]>> {
  const task = data.tasks.find((t) => t.id === taskId)
  if (!task) return Promise.resolve({ ok: false, error: 'Tâche introuvable.' })
  const desc = task.blocks.map((b) => b.text).filter(Boolean).join('\n')
  const system = `${BASE_SYSTEM}\n${PROPOSAL_FORMAT}\n\n=== RÉFÉRENTIEL ===\n${referenceSection(data)}`
  return askProposals(data, system,
    `Décompose cette tâche en 3 à 8 sous-tâches concrètes (kind=createTask, parentId="${task.id}", projectId=${task.projectId ? `"${task.projectId}"` : 'null'}) :\nTitre : ${task.title}\nDescription :\n${desc || '(vide)'}`)
}

/** Triage intelligent des tâches non triées (§8) : propositions, jamais appliquées d'office. */
export function proposeTriage(data: WorkspaceData): Promise<AiResult<Proposal[]>> {
  const system = `${BASE_SYSTEM}\n${PROPOSAL_FORMAT}\n\n=== RÉFÉRENTIEL ===\n${referenceSection(data)}\n\n${tasksSection(data, { openOnly: true })}`
  return askProposals(data, system,
    `Parmi les tâches ouvertes ci-dessus, identifie celles qui semblent non triées (pas de priorité, pas de projet, pas d'étiquette pertinente) et propose pour chacune un triage (kind=updateTask : priorité et/ou projet et/ou étiquettes et/ou statut). Maximum 10 propositions, uniquement quand le titre rend le triage évident.`)
}

/** Insights en langage naturel — reformulation des moteurs locaux, pas de calcul dupliqué. */
export async function narrateInsights(data: WorkspaceData, now = new Date()): Promise<AiResult<string>> {
  const facts = computeInsights(data, now).lines
  return ask(
    `${BASE_SYSTEM}\nTa tâche : reformuler les faits chiffrés fournis en 3 à 6 observations utiles et actionnables. N'invente aucun chiffre : chaque observation doit s'appuyer sur un fait fourni.`,
    [{ role: 'user', text: `Faits (calculés localement par les moteurs de rapports) :\n${facts.map((l) => `- ${l}`).join('\n')}` }]
  )
}

export interface SemanticHit {
  type: 'page' | 'task'
  id: string
}

/** Recherche sémantique optionnelle (§8) — complément de la recherche plein texte locale. */
export async function semanticSearch(data: WorkspaceData, query: string): Promise<AiResult<SemanticHit[]>> {
  const system = `${BASE_SYSTEM}\nTa tâche : retrouver les éléments les plus pertinents sémantiquement pour la requête, même sans correspondance exacte de mots.
Réponds UNIQUEMENT avec un tableau JSON : [{"type":"page"|"task","id":"…"}], max 10, ordonné du plus pertinent au moins pertinent. Tableau vide si rien de pertinent.
\n${pagesSection(data)}\n\n${tasksSection(data)}`
  const r = await ask(system, [{ role: 'user', text: `Requête : ${query}` }])
  if (!r.ok) return r
  const raw = extractJson(r.value)
  const pageIds = new Set(data.pages.map((p) => p.id))
  const taskIds = new Set(data.tasks.map((t) => t.id))
  const hits: SemanticHit[] = []
  if (Array.isArray(raw)) {
    for (const h of raw.slice(0, 10)) {
      if (!h || typeof h !== 'object') continue
      const { type, id } = h as { type?: unknown; id?: unknown }
      if (type === 'page' && typeof id === 'string' && pageIds.has(id)) hits.push({ type: 'page', id })
      else if (type === 'task' && typeof id === 'string' && taskIds.has(id)) hits.push({ type: 'task', id })
    }
  }
  return { ok: true, value: hits }
}
