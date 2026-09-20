import { describe, it, expect } from 'vitest'
import type { Page } from './types'
import {
  childrenOf, descendantsOf, ancestorsOf, isSelfOrDescendant,
  movePage, deleteSubtree, nextOrder,
} from './tree'

function page(id: string, parentId: string | null, order = 0): Page {
  return {
    id, title: id, parentId, order, kind: 'page', blocks: [],
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

// a ── b ── c
//  └── d
const pages = [page('a', null, 0), page('b', 'a', 0), page('c', 'b', 0), page('d', 'a', 1)]

describe('tree', () => {
  it('liste les enfants triés par ordre', () => {
    expect(childrenOf(pages, 'a').map((p) => p.id)).toEqual(['b', 'd'])
    expect(childrenOf(pages, null).map((p) => p.id)).toEqual(['a'])
  })

  it('trouve tous les descendants', () => {
    expect(descendantsOf(pages, 'a').map((p) => p.id).sort()).toEqual(['b', 'c', 'd'])
    expect(descendantsOf(pages, 'c')).toEqual([])
  })

  it('remonte les ancêtres dans l’ordre racine → parent', () => {
    expect(ancestorsOf(pages, 'c').map((p) => p.id)).toEqual(['a', 'b'])
    expect(ancestorsOf(pages, 'a')).toEqual([])
  })

  it('survit à un cycle corrompu sans boucle infinie', () => {
    const corrupted = [page('x', 'y'), page('y', 'x')]
    expect(ancestorsOf(corrupted, 'x').length).toBeLessThan(3)
  })

  it('détecte soi-même et les descendants', () => {
    expect(isSelfOrDescendant(pages, 'a', 'a')).toBe(true)
    expect(isSelfOrDescendant(pages, 'a', 'c')).toBe(true)
    expect(isSelfOrDescendant(pages, 'b', 'd')).toBe(false)
  })

  it('refuse de déplacer une page dans son propre sous-arbre', () => {
    expect(movePage(pages, 'a', 'c', 0)).toBe(pages)
  })

  it('déplace une page et réordonne les frères', () => {
    const moved = movePage(pages, 'c', 'a', 0)
    expect(childrenOf(moved, 'a').map((p) => p.id)).toEqual(['c', 'b', 'd'])
    expect(childrenOf(moved, 'b')).toEqual([])
  })

  it('déplace à la racine', () => {
    const moved = movePage(pages, 'b', null, 1)
    expect(childrenOf(moved, null).map((p) => p.id)).toEqual(['a', 'b'])
    // c suit son parent b
    expect(descendantsOf(moved, 'b').map((p) => p.id)).toEqual(['c'])
  })

  it('supprime un sous-arbre complet', () => {
    const rest = deleteSubtree(pages, 'b')
    expect(rest.map((p) => p.id).sort()).toEqual(['a', 'd'])
  })

  it('calcule le prochain ordre', () => {
    expect(nextOrder(pages, 'a')).toBe(2)
    expect(nextOrder(pages, 'c')).toBe(0)
  })
})
