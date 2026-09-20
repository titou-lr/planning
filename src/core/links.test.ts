import { describe, it, expect } from 'vitest'
import type { Page } from './types'
import { extractLinkTitles, buildBacklinkIndex, splitByLinks, buildTitleIndex } from './links'

function page(id: string, title: string, texts: string[]): Page {
  return {
    id, title, parentId: null, order: 0, kind: 'page',
    blocks: texts.map((t, i) => ({ id: `${id}-b${i}`, type: 'paragraph' as const, text: t })),
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('links', () => {
  it('extrait les titres [[...]]', () => {
    expect(extractLinkTitles('voir [[Projet Alpha]] et [[ Notes ]]')).toEqual(['Projet Alpha', 'Notes'])
    expect(extractLinkTitles('aucun lien')).toEqual([])
  })

  it('construit l’index de backlinks (insensible à la casse)', () => {
    const a = page('a', 'Projet Alpha', ['intro'])
    const b = page('b', 'Journal', ['penser à [[projet alpha]]', 'encore [[Projet Alpha]]'])
    const c = page('c', 'Autre', ['rien'])
    const idx = buildBacklinkIndex([a, b, c])
    expect(idx.get('a')).toEqual(['b']) // dédupliqué
    expect(idx.get('c')).toBeUndefined()
  })

  it('ignore les auto-références', () => {
    const a = page('a', 'Boucle', ['je suis [[Boucle]]'])
    expect(buildBacklinkIndex([a]).get('a')).toBeUndefined()
  })

  it('découpe un texte en segments texte/lien', () => {
    expect(splitByLinks('avant [[X]] après')).toEqual([
      { kind: 'text', value: 'avant ' },
      { kind: 'link', title: 'X' },
      { kind: 'text', value: ' après' },
    ])
  })

  it('résout les liens dans les cellules de table', () => {
    const target = page('t', 'Cible', [])
    const src: Page = {
      ...page('s', 'Source', []),
      blocks: [{ id: 'tb', type: 'table', text: '', rows: [['col'], ['voir [[Cible]]']] }],
    }
    expect(buildBacklinkIndex([target, src]).get('t')).toEqual(['s'])
  })

  it('indexe les titres normalisés', () => {
    const idx = buildTitleIndex([page('a', '  Ma Page  ', [])])
    expect(idx.get('ma page')?.id).toBe('a')
  })
})
