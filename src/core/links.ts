import type { Page } from './types'

/**
 * Liens entre pages : syntaxe [[Titre de page]] dans le texte des blocs.
 * Résolution par titre (insensible à la casse). Index de backlinks
 * construit en un seul passage — O(pages × blocs), recalculé de façon
 * mémoïsée côté UI (dégradation progressive à grande échelle).
 */

const LINK_RE = /\[\[([^\[\]]+)\]\]/g

/** Titres référencés par un texte (bruts, non résolus). */
export function extractLinkTitles(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(LINK_RE)) out.push(m[1].trim())
  return out
}

/** Tous les titres référencés par une page (tous blocs + cellules de table). */
export function pageLinkTitles(page: Page): string[] {
  const titles: string[] = []
  for (const b of page.blocks) {
    titles.push(...extractLinkTitles(b.text))
    if (b.rows) for (const row of b.rows) for (const cell of row) titles.push(...extractLinkTitles(cell))
  }
  return titles
}

export function titleKey(title: string): string {
  return title.trim().toLowerCase()
}

/** Index titre (normalisé) → page. En cas de doublon de titre, la première gagne. */
export function buildTitleIndex(pages: Page[]): Map<string, Page> {
  const idx = new Map<string, Page>()
  for (const p of pages) {
    const key = titleKey(p.title)
    if (key && !idx.has(key)) idx.set(key, p)
  }
  return idx
}

/** Index pageId → ids des pages qui la mentionnent (backlinks). */
export function buildBacklinkIndex(pages: Page[]): Map<string, string[]> {
  const titleIdx = buildTitleIndex(pages)
  const back = new Map<string, string[]>()
  for (const p of pages) {
    const seen = new Set<string>()
    for (const t of pageLinkTitles(p)) {
      const target = titleIdx.get(titleKey(t))
      if (target && target.id !== p.id && !seen.has(target.id)) {
        seen.add(target.id)
        const arr = back.get(target.id) ?? []
        arr.push(p.id)
        back.set(target.id, arr)
      }
    }
  }
  return back
}

/** Segments d'un texte : alternance texte brut / lien, pour le rendu inline. */
export type LinkSegment = { kind: 'text'; value: string } | { kind: 'link'; title: string }

export function splitByLinks(text: string): LinkSegment[] {
  const segs: LinkSegment[] = []
  let last = 0
  for (const m of text.matchAll(LINK_RE)) {
    const i = m.index ?? 0
    if (i > last) segs.push({ kind: 'text', value: text.slice(last, i) })
    segs.push({ kind: 'link', title: m[1].trim() })
    last = i + m[0].length
  }
  if (last < text.length) segs.push({ kind: 'text', value: text.slice(last) })
  return segs
}
