import { describe, it, expect } from 'vitest'
import { parseTable, rowsToCsv, coerceCell } from './csvio'
import type { Page, PropertyDef } from './types'

describe('csvio', () => {
  it('parse un CSV brut', () => {
    const { headers, rows } = parseTable('Nom,Prix\nPomme,2\nPoire,3\n')
    expect(headers).toEqual(['Nom', 'Prix'])
    expect(rows).toEqual([['Pomme', '2'], ['Poire', '3']])
  })

  it('round-trip export → import', () => {
    const props: PropertyDef[] = [
      { id: 'n', name: 'Prix', type: 'number' },
      { id: 'c', name: 'Fait', type: 'checkbox' },
    ]
    const rows: Page[] = [{
      id: 'r1', title: 'Pomme, bio', parentId: 'db', order: 0, kind: 'page',
      blocks: [], props: { n: 2, c: true },
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }]
    const csv = rowsToCsv(rows, props)
    const parsed = parseTable(csv)
    expect(parsed.headers).toEqual(['Titre', 'Prix', 'Fait'])
    expect(parsed.rows[0][0]).toBe('Pomme, bio') // virgule échappée correctement
    expect(parsed.rows[0][1]).toBe('2')
  })

  it('coerce les cellules selon le type', () => {
    const sel: PropertyDef = {
      id: 's', name: 'Statut', type: 'select',
      options: [{ id: 'opt1', name: 'En cours', color: 'cat-blue' }],
    }
    expect(coerceCell('3,5', { id: 'n', name: 'N', type: 'number' })).toBe(3.5)
    expect(coerceCell('abc', { id: 'n', name: 'N', type: 'number' })).toBeNull()
    expect(coerceCell('oui', { id: 'c', name: 'C', type: 'checkbox' })).toBe(true)
    expect(coerceCell('en cours', sel)).toBe('opt1')
    expect(coerceCell('inconnu', sel)).toBe('inconnu')
    expect(coerceCell('a; b', { id: 'm', name: 'M', type: 'multiSelect', options: [] })).toEqual(['a', 'b'])
    expect(coerceCell('', sel)).toBeNull()
  })
})
