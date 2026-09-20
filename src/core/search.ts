import type { Page } from './types'

/**
 * Recherche plein texte pure : titres, contenu des blocs, cellules de
 * table et valeurs de propriétés. Score simple : titre > contenu,
 * préfixe > inclusion. Insensible à la casse et aux accents.
 */

export interface SearchResult {
  pageId: string
  score: number
  /** Extrait du bloc contenant la correspondance (vide si match sur titre seul). */
  excerpt: string
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function makeExcerpt(text: string, needle: string, radius = 40): string {
  const idx = normalize(text).indexOf(needle)
  if (idx < 0) return text.slice(0, radius * 2)
  const start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + needle.length + radius)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

export function searchPages(pages: Page[], query: string, limit = 30): SearchResult[] {
  const q = normalize(query.trim())
  if (!q) return []
  const terms = q.split(/\s+/).filter(Boolean)
  const results: SearchResult[] = []

  for (const page of pages) {
    const title = normalize(page.title)
    let score = 0
    let excerpt = ''

    const titleHit = terms.every((t) => title.includes(t))
    if (titleHit) {
      score += title.startsWith(terms[0]) ? 100 : 60
    }

    // Contenu : tous les termes doivent apparaître quelque part dans la page
    const texts: string[] = []
    for (const b of page.blocks) {
      if (b.text) texts.push(b.text)
      if (b.rows) for (const row of b.rows) texts.push(row.join(' '))
    }
    if (page.props) {
      for (const v of Object.values(page.props)) {
        if (typeof v === 'string') texts.push(v)
        else if (Array.isArray(v)) texts.push(v.join(' '))
      }
    }
    const full = normalize(texts.join('\n'))
    const contentHit = !titleHit && terms.every((t) => title.includes(t) || full.includes(t))
    if (contentHit) {
      score += 30
      const firstTerm = terms.find((t) => full.includes(t))
      if (firstTerm) {
        const src = texts.find((t) => normalize(t).includes(firstTerm))
        if (src) excerpt = makeExcerpt(src, firstTerm)
      }
    } else if (titleHit) {
      const firstTerm = terms.find((t) => full.includes(t))
      if (firstTerm) {
        const src = texts.find((t) => normalize(t).includes(firstTerm))
        if (src) excerpt = makeExcerpt(src, firstTerm)
      }
    }

    if (score > 0) results.push({ pageId: page.id, score, excerpt })
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit)
}
