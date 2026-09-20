import { describe, it, expect } from 'vitest'
import type { Page } from './types'
import { searchPages, normalize } from './search'

function page(id: string, title: string, texts: string[] = [], props?: Page['props']): Page {
  return {
    id, title, parentId: null, order: 0, kind: 'page', props,
    blocks: texts.map((t, i) => ({ id: `${id}-b${i}`, type: 'paragraph' as const, text: t })),
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('search', () => {
  const pages = [
    page('a', 'Réunion équipe', ['ordre du jour : budget']),
    page('b', 'Courses', ['acheter du café', 'et une réunion imprévue']),
    page('c', 'Budget 2026', ['prévisions']),
  ]

  it('normalise casse et accents', () => {
    expect(normalize('Réunion Équipe')).toBe('reunion equipe')
  })

  it('trouve par titre avec priorité au préfixe', () => {
    const r = searchPages(pages, 'réunion')
    expect(r[0].pageId).toBe('a') // préfixe de titre
    expect(r.map((x) => x.pageId)).toContain('b') // contenu
  })

  it('trouve dans le contenu des blocs avec extrait', () => {
    const r = searchPages(pages, 'café')
    expect(r).toHaveLength(1)
    expect(r[0].pageId).toBe('b')
    expect(r[0].excerpt).toContain('café')
  })

  it('cherche dans les valeurs de propriétés', () => {
    const withProps = [page('d', 'Ligne', [], { p1: 'urgentissime' })]
    expect(searchPages(withProps, 'urgentissime')[0]?.pageId).toBe('d')
  })

  it('exige tous les termes', () => {
    expect(searchPages(pages, 'budget prévisions')).toHaveLength(1)
    expect(searchPages(pages, 'budget inexistant')).toHaveLength(0)
  })

  it('requête vide → aucun résultat', () => {
    expect(searchPages(pages, '  ')).toEqual([])
  })
})
