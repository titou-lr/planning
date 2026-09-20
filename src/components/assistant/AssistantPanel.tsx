import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import {
  chat, narrateInsights, proposeSubtasks, proposeTriage, semanticSearch, summarize,
  type AiResult, type ChatTurn, type SemanticHit,
} from '../../store/aiService'
import { getAiSettings, useAiSettings } from '../../store/aiSettings'
import { proposalLabel, type Proposal } from '../../core/ai/proposals'
import { pageToMarkdown, markdownToBlocks } from '../../core/markdown'
import { findPage } from '../../core/tree'
import { uid } from '../../core/id'
import { useToast } from '../Toast'
import { IconCheckCircle, IconFile, IconSearch, IconWand, IconX } from '../icons'

/**
 * Assistant IA (§8) — panneau latéral. Lecture seule sur les données ;
 * TOUTE écriture passe par une carte de proposition Confirmer/Annuler
 * ci-dessous (applyProposal), y compris en mode auto-triage où
 * l'application immédiate est un choix explicite de l'utilisateur.
 */

interface FeedItem {
  id: string
  role: 'user' | 'assistant' | 'error' | 'info'
  text: string
  proposals?: Proposal[]
  hits?: SemanticHit[]
}

/** Point d'application UNIQUE des propositions : mutations du store (annulables via Ctrl+Z). */
function applyProposal(p: Proposal) {
  const s = useStore.getState()
  switch (p.kind) {
    case 'createTask':
      s.createTask({
        title: p.title, priority: p.priority, dueDate: p.dueDate,
        projectId: p.projectId, parentId: p.parentId, estimateMin: p.estimateMin,
      })
      break
    case 'updateTask':
      s.updateTask(p.taskId, p.patch)
      break
    case 'createEvent':
      s.createEvent({ title: p.title, start: p.start, end: p.end })
      break
    case 'createPage': {
      const id = s.createPage(null, 'page', p.title)
      s.setBlocks(id, p.markdown ? markdownToBlocks(p.markdown) : [{ id: uid(), type: 'paragraph', text: '' }])
      break
    }
  }
}

export default function AssistantPanel({ onClose, onOpenSettings }: { onClose: () => void; onOpenSettings: () => void }) {
  const data = useStore((s) => s.data)
  const currentPageId = useStore((s) => s.currentPageId)
  const selectedTaskId = useStore((s) => s.selectedTaskId)
  const show = useToast((s) => s.show)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [semantic, setSemantic] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const hasKey = useAiSettings((s) => Boolean(s.apiKey))

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [feed, busy])

  function push(item: Omit<FeedItem, 'id'>) {
    setFeed((f) => [...f, { ...item, id: uid() }])
  }

  async function run<T>(fn: () => Promise<AiResult<T>>, onOk: (v: T) => void) {
    setBusy(true)
    try {
      const r = await fn()
      if (r.ok) onOk(r.value)
      else push({ role: 'error', text: r.error })
    } finally {
      setBusy(false)
    }
  }

  function pushProposals(proposals: Proposal[], emptyMsg: string, autoApplied = false) {
    if (!proposals.length) push({ role: 'info', text: emptyMsg })
    else if (autoApplied) push({ role: 'info', text: `${proposals.length} triage(s) appliqué(s) automatiquement (mode auto-application actif — annulable via Ctrl+Z).` })
    else push({ role: 'assistant', text: 'Propositions — rien n’est appliqué sans ta confirmation :', proposals })
  }

  function send() {
    const q = input.trim()
    if (!q || busy) return
    setInput('')
    push({ role: 'user', text: q })
    if (semantic) {
      void run(() => semanticSearch(data, q), (hits) => {
        if (!hits.length) push({ role: 'info', text: 'Aucun résultat sémantique. La recherche plein texte (Ctrl+K) reste disponible.' })
        else push({ role: 'assistant', text: 'Résultats les plus pertinents :', hits })
      })
      return
    }
    const turns: ChatTurn[] = [
      ...feed.filter((f) => f.role === 'user' || f.role === 'assistant').map((f) => ({ role: f.role as 'user' | 'assistant', text: f.text })),
      { role: 'user', text: q },
    ]
    void run(() => chat(data, turns), (text) => push({ role: 'assistant', text }))
  }

  function doSummarize() {
    const page = currentPageId ? findPage(data.pages, currentPageId) : undefined
    if (page) {
      push({ role: 'user', text: `Résumer la page « ${page.title || 'Sans titre'} »` })
      void run(() => summarize(`la note « ${page.title} »`, pageToMarkdown(page)), (text) => push({ role: 'assistant', text }))
      return
    }
    const open = data.tasks.filter((t) => data.statuses.find((s) => s.id === t.statusId)?.category !== 'done')
    push({ role: 'user', text: 'Résumer les tâches en cours' })
    const content = open.map((t) => `- ${t.title} (${data.statuses.find((s) => s.id === t.statusId)?.name})`).join('\n')
    void run(() => summarize('cet ensemble de tâches', content), (text) => push({ role: 'assistant', text }))
  }

  function doSubtasks() {
    if (!selectedTaskId) {
      push({ role: 'info', text: 'Ouvre d’abord une tâche (panneau de détail) pour générer ses sous-tâches.' })
      return
    }
    const task = data.tasks.find((t) => t.id === selectedTaskId)
    push({ role: 'user', text: `Générer des sous-tâches pour « ${task?.title || '(sans titre)'} »` })
    void run(() => proposeSubtasks(data, selectedTaskId), (proposals) =>
      pushProposals(proposals, 'Aucune décomposition proposée.'))
  }

  function doTriage() {
    push({ role: 'user', text: 'Trier les tâches non triées' })
    const auto = getAiSettings().autoTriage
    void run(() => proposeTriage(data), (proposals) => {
      // Mode auto-application (§8) : uniquement si activé explicitement dans les réglages
      if (auto) {
        for (const p of proposals) applyProposal(p)
        pushProposals(proposals, 'Rien à trier.', true)
      } else {
        pushProposals(proposals, 'Rien à trier : les tâches ouvertes semblent déjà organisées.')
      }
    })
  }

  function doInsights() {
    push({ role: 'user', text: 'Insights sur mon travail' })
    void run(() => narrateInsights(data), (text) => push({ role: 'assistant', text }))
  }

  function confirmProposal(itemId: string, index: number, p: Proposal) {
    applyProposal(p)
    show('Proposition appliquée (annulable via Ctrl+Z)')
    dismissProposal(itemId, index)
  }

  function dismissProposal(itemId: string, index: number) {
    setFeed((f) => f.map((item) =>
      item.id === itemId && item.proposals
        ? { ...item, proposals: item.proposals.filter((_, i) => i !== index) }
        : item
    ))
  }

  function openHit(h: SemanticHit) {
    const s = useStore.getState()
    if (h.type === 'page') s.setCurrentPage(h.id)
    else { s.setSection('tasks'); s.setSelectedTask(h.id) }
  }

  return (
    <aside className="detail-panel col">
      <div className="subhead-bar spread" style={{ flex: 'none' }}>
        <span className="row gap6 subhead"><IconWand width={14} height={14} /> Assistant</span>
        <button className="btn btn-icon btn-sm btn-ghost" onClick={onClose}><IconX width={14} height={14} /></button>
      </div>

      {!hasKey && (
        <div className="col gap8" style={{ padding: 16 }}>
          <span className="caption">
            L’assistant appelle le modèle Claude via ta propre clé API — c’est la seule fonction
            de l’app qui utilise le réseau, et uniquement quand tu la sollicites. Sans clé,
            tout le reste de l’app fonctionne normalement.
          </span>
          <button className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={onOpenSettings}>
            Configurer la clé API…
          </button>
        </div>
      )}

      <div className="row gap6 no-print" style={{ padding: '8px 12px', flexWrap: 'wrap', flex: 'none' }}>
        <button className="chip" disabled={busy || !hasKey} onClick={doSummarize}>Résumer</button>
        <button className="chip" disabled={busy || !hasKey} onClick={doSubtasks}>Sous-tâches</button>
        <button className="chip" disabled={busy || !hasKey} onClick={doTriage}>Triage</button>
        <button className="chip" disabled={busy || !hasKey} onClick={doInsights}>Insights</button>
        <button
          className={`chip${semantic ? ' on' : ''}`}
          disabled={!hasKey}
          title="Recherche sémantique (complément de la recherche plein texte Ctrl+K)"
          onClick={() => setSemantic((v) => !v)}
        >
          <IconSearch width={11} height={11} /> Sémantique
        </button>
      </div>

      <div ref={scrollRef} className="scroll col gap10" style={{ flex: 1, padding: '4px 12px 12px' }}>
        {feed.length === 0 && (
          <span className="caption" style={{ padding: '8px 4px' }}>
            Pose une question sur tes notes, tâches et calendrier — l’assistant lit tes données
            localement et n’écrit jamais rien sans une confirmation explicite de ta part.
          </span>
        )}
        {feed.map((item) => (
          <div key={item.id} className="col gap6">
            {item.role === 'user' ? (
              <div className="panel-flush" style={{ padding: '8px 10px', alignSelf: 'flex-end', maxWidth: '92%', background: 'var(--surface-2)' }}>
                <span style={{ fontSize: 13 }}>{item.text}</span>
              </div>
            ) : (
              <div className="col gap6" style={{ maxWidth: '96%' }}>
                <span
                  className={item.role === 'error' ? 'caption' : ''}
                  style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: item.role === 'error' ? 'var(--warning)' : item.role === 'info' ? 'var(--ink-subtle)' : 'var(--ink)' }}
                >
                  {item.text}
                </span>
                {item.proposals?.map((p, i) => (
                  <div key={i} className="panel-flush col gap8" style={{ padding: 10 }}>
                    <span style={{ fontSize: 12.5 }}>{proposalLabel(p, data)}</span>
                    {p.kind === 'createPage' && p.markdown && (
                      <span className="caption" style={{ whiteSpace: 'pre-wrap', maxHeight: 96, overflow: 'hidden' }}>{p.markdown.slice(0, 400)}</span>
                    )}
                    <div className="row gap6">
                      <button className="btn btn-sm btn-primary" onClick={() => confirmProposal(item.id, i, p)}>
                        <IconCheckCircle width={12} height={12} /> Confirmer
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => dismissProposal(item.id, i)}>Annuler</button>
                    </div>
                  </div>
                ))}
                {item.hits?.map((h) => {
                  const label = h.type === 'page'
                    ? findPage(data.pages, h.id)?.title || '(sans titre)'
                    : data.tasks.find((t) => t.id === h.id)?.title || '(sans titre)'
                  return (
                    <button key={h.type + h.id} className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => openHit(h)}>
                      {h.type === 'page' ? <IconFile width={13} height={13} /> : <IconCheckCircle width={13} height={13} />} {label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
        {busy && <span className="caption">L’assistant réfléchit…</span>}
      </div>

      <div className="row gap6" style={{ padding: 12, borderTop: '1px solid var(--hairline)', flex: 'none' }}>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder={semantic ? 'Recherche sémantique…' : 'Question sur tes données…'}
          value={input}
          disabled={!hasKey || busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send() }}
        />
        <button className="btn btn-primary" disabled={!hasKey || busy || !input.trim()} onClick={send}>Envoyer</button>
      </div>
    </aside>
  )
}
