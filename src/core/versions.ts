import type { Block, Page, PageVersion } from './types'
import { uid } from './id'

/**
 * Historique de versions par page. Une version = snapshot titre + blocs.
 * Coalescence temporelle : si la dernière version date de moins de
 * COALESCE_MS, elle est remplacée au lieu d'empiler (évite une version
 * par frappe). Pas de limite artificielle de durée (CLAUDE.md §5.7).
 */

export const COALESCE_MS = 5 * 60 * 1000

export function sameContent(a: { title: string; blocks: Block[] }, b: { title: string; blocks: Block[] }): boolean {
  return a.title === b.title && JSON.stringify(a.blocks) === JSON.stringify(b.blocks)
}

export function recordVersion(
  history: PageVersion[],
  page: Pick<Page, 'title' | 'blocks'>,
  now: string
): PageVersion[] {
  const last = history[history.length - 1]
  if (last && sameContent(last, page)) return history
  const version: PageVersion = {
    id: uid(),
    at: now,
    title: page.title,
    blocks: JSON.parse(JSON.stringify(page.blocks)),
  }
  if (last && new Date(now).getTime() - new Date(last.at).getTime() < COALESCE_MS) {
    return [...history.slice(0, -1), version]
  }
  return [...history, version]
}
