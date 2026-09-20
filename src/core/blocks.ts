import type { Block, BlockType } from './types'
import { uid } from './id'

/** Opérations pures sur les blocs de l'éditeur. */

export function newBlock(type: BlockType = 'paragraph', text = ''): Block {
  return { id: uid(), type, text }
}

/**
 * Raccourcis markdown en début de ligne : "# ", "- ", "1. ", "> ",
 * "[] ", "```", "---". Retourne la transformation à appliquer, ou null.
 */
export function detectShortcut(text: string): { type: BlockType; rest: string } | null {
  let m: RegExpMatchArray | null
  if ((m = text.match(/^#\s(.*)$/))) return { type: 'heading1', rest: m[1] }
  if ((m = text.match(/^##\s(.*)$/))) return { type: 'heading2', rest: m[1] }
  if ((m = text.match(/^###\s(.*)$/))) return { type: 'heading3', rest: m[1] }
  if ((m = text.match(/^(?:\[\]|\[ \])\s(.*)$/))) return { type: 'todo', rest: m[1] }
  if ((m = text.match(/^[-*]\s(.*)$/))) return { type: 'bulleted', rest: m[1] }
  if ((m = text.match(/^1[.)]\s(.*)$/))) return { type: 'numbered', rest: m[1] }
  if ((m = text.match(/^>\s(.*)$/))) return { type: 'quote', rest: m[1] }
  if (text === '```') return { type: 'code', rest: '' }
  if (text === '---') return { type: 'divider', rest: '' }
  return null
}

/** Type du bloc créé par Entrée depuis `type` (les listes se poursuivent). */
export function continuationType(type: BlockType): BlockType {
  return ['bulleted', 'numbered', 'todo'].includes(type) ? type : 'paragraph'
}

export function insertBlockAfter(blocks: Block[], afterId: string, block: Block): Block[] {
  const idx = blocks.findIndex((b) => b.id === afterId)
  if (idx < 0) return [...blocks, block]
  return [...blocks.slice(0, idx + 1), block, ...blocks.slice(idx + 1)]
}

export function updateBlock(blocks: Block[], id: string, patch: Partial<Block>): Block[] {
  return blocks.map((b) => (b.id === id ? { ...b, ...patch } : b))
}

export function removeBlock(blocks: Block[], id: string): Block[] {
  return blocks.filter((b) => b.id !== id)
}

/** Déplace le bloc `id` à l'index `toIndex` (réordonnancement drag-and-drop). */
export function moveBlock(blocks: Block[], id: string, toIndex: number): Block[] {
  const from = blocks.findIndex((b) => b.id === id)
  if (from < 0) return blocks
  const out = [...blocks]
  const [moved] = out.splice(from, 1)
  out.splice(Math.max(0, Math.min(toIndex, out.length)), 0, moved)
  return out
}

/** Segments inline : texte / gras / italique / code — rendu markdown léger. */
export type InlineSegment =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'code'; value: string }

const INLINE_RE = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g

export function parseInline(text: string): InlineSegment[] {
  const segs: InlineSegment[] = []
  let last = 0
  for (const m of text.matchAll(INLINE_RE)) {
    const i = m.index ?? 0
    if (i > last) segs.push({ kind: 'text', value: text.slice(last, i) })
    if (m[2] !== undefined) segs.push({ kind: 'bold', value: m[2] })
    else if (m[4] !== undefined) segs.push({ kind: 'italic', value: m[4] })
    else if (m[6] !== undefined) segs.push({ kind: 'code', value: m[6] })
    last = i + m[0].length
  }
  if (last < text.length) segs.push({ kind: 'text', value: text.slice(last) })
  return segs
}
