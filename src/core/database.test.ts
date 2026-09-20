import { describe, it, expect } from 'vitest'
import type { Page, PropertyDef } from './types'
import { matchesFilter, applyView, groupRows, compareValues, formatPropValue, defaultSchema } from './database'

function row(id: string, title: string, props: Page['props'], order = 0): Page {
  return {
    id, title, parentId: 'db', order, kind: 'page', blocks: [], props,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

const statusProp: PropertyDef = {
  id: 'st', name: 'Statut', type: 'select',
  options: [
    { id: 'todo', name: 'À faire', color: 'cat-gray' },
    { id: 'done', name: 'Terminé', color: 'cat-green' },
  ],
}

const rows = [
  row('r1', 'Alpha', { st: 'todo', n: 3 }, 0),
  row('r2', 'Bêta', { st: 'done', n: 1 }, 1),
  row('r3', 'Gamma', { st: null, n: 2 }, 2),
]

describe('database', () => {
  it('filtre equals / notEquals / isEmpty', () => {
    expect(rows.filter((r) => matchesFilter(r, { propId: 'st', op: 'equals', value: 'todo' })).map((r) => r.id)).toEqual(['r1'])
    expect(rows.filter((r) => matchesFilter(r, { propId: 'st', op: 'notEquals', value: 'todo' })).map((r) => r.id)).toEqual(['r2', 'r3'])
    expect(rows.filter((r) => matchesFilter(r, { propId: 'st', op: 'isEmpty' })).map((r) => r.id)).toEqual(['r3'])
  })

  it('filtre contains sur le titre (__title) sans accent', () => {
    expect(rows.filter((r) => matchesFilter(r, { propId: '__title', op: 'contains', value: 'beta' })).map((r) => r.id)).toEqual(['r2'])
  })

  it('filtre gt/lt numérique', () => {
    expect(rows.filter((r) => matchesFilter(r, { propId: 'n', op: 'gt', value: 1 })).map((r) => r.id)).toEqual(['r1', 'r3'])
    expect(rows.filter((r) => matchesFilter(r, { propId: 'n', op: 'lt', value: 2 })).map((r) => r.id)).toEqual(['r2'])
  })

  it('applique tri multiple, vides en dernier', () => {
    const sorted = applyView(rows, { filters: [], sorts: [{ propId: 'st', dir: 'asc' }, { propId: 'n', dir: 'desc' }] })
    expect(sorted[sorted.length - 1].id).toBe('r3') // st vide en dernier
  })

  it('tri par défaut = ordre manuel', () => {
    const out = applyView([rows[2], rows[0], rows[1]], { filters: [], sorts: [] })
    expect(out.map((r) => r.id)).toEqual(['r1', 'r2', 'r3'])
  })

  it('regroupe en colonnes kanban avec groupe "sans valeur"', () => {
    const groups = groupRows(rows, statusProp)
    expect(groups.map((g) => g.optionId)).toEqual([null, 'todo', 'done'])
    expect(groups[0].rows.map((r) => r.id)).toEqual(['r3'])
    expect(groups[1].rows.map((r) => r.id)).toEqual(['r1'])
  })

  it('compare numériquement et alphabétiquement', () => {
    expect(compareValues(2, 10)).toBeLessThan(0)
    expect(compareValues('a2', 'a10')).toBeLessThan(0) // numeric collation
    expect(compareValues(null, 'x')).toBeGreaterThan(0) // vide après
  })

  it('formate les valeurs select/multiSelect/checkbox', () => {
    expect(formatPropValue('todo', statusProp)).toBe('À faire')
    expect(formatPropValue(true, { id: 'c', name: 'OK', type: 'checkbox' })).toBe('✓')
    const multi: PropertyDef = { id: 'm', name: 'Tags', type: 'multiSelect', options: statusProp.options }
    expect(formatPropValue(['todo', 'done'], multi)).toBe('À faire, Terminé')
  })

  it('schéma par défaut : 2 propriétés, 3 vues dont kanban groupé', () => {
    const s = defaultSchema()
    expect(s.properties).toHaveLength(2)
    expect(s.views.map((v) => v.type)).toEqual(['table', 'kanban', 'gallery'])
    expect(s.views[1].groupBy).toBe(s.properties[0].id)
  })
})
