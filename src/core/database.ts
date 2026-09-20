import type { Filter, Page, PropertyDef, PropValue, ViewDef, DatabaseSchema, SelectOption } from './types'
import { uid } from './id'
import { normalize } from './search'

/**
 * Moteur pur des bases de données : filtres, tris, regroupement kanban.
 * Aucune dépendance UI. Les lignes d'une base sont les pages enfants
 * de la page database ; leurs valeurs vivent dans page.props.
 */

export function propValue(row: Page, propId: string): PropValue {
  if (propId === '__title') return row.title
  return row.props?.[propId] ?? null
}

function isEmptyValue(v: PropValue): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
}

export function matchesFilter(row: Page, f: Filter): boolean {
  const v = propValue(row, f.propId)
  switch (f.op) {
    case 'isEmpty': return isEmptyValue(v)
    case 'isNotEmpty': return !isEmptyValue(v)
    case 'equals':
      if (Array.isArray(v)) return v.includes(String(f.value))
      return v === f.value
    case 'notEquals':
      if (Array.isArray(v)) return !v.includes(String(f.value))
      return v !== f.value
    case 'contains': {
      const needle = normalize(String(f.value ?? ''))
      if (Array.isArray(v)) return v.some((x) => normalize(String(x)).includes(needle))
      return normalize(String(v ?? '')).includes(needle)
    }
    case 'gt': return typeof v === 'number' && typeof f.value === 'number' ? v > f.value : String(v ?? '') > String(f.value ?? '')
    case 'lt': return typeof v === 'number' && typeof f.value === 'number' ? v < f.value : (!isEmptyValue(v) && String(v) < String(f.value ?? ''))
    default: return true
  }
}

export function compareValues(a: PropValue, b: PropValue): number {
  if (isEmptyValue(a) && isEmptyValue(b)) return 0
  if (isEmptyValue(a)) return 1 // vides en dernier
  if (isEmptyValue(b)) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  const sa = Array.isArray(a) ? a.join(',') : String(a)
  const sb = Array.isArray(b) ? b.join(',') : String(b)
  return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' })
}

export function applyView(rows: Page[], view: Pick<ViewDef, 'filters' | 'sorts'>): Page[] {
  let out = rows.filter((r) => view.filters.every((f) => matchesFilter(r, f)))
  if (view.sorts.length) {
    out = [...out].sort((a, b) => {
      for (const s of view.sorts) {
        const cmp = compareValues(propValue(a, s.propId), propValue(b, s.propId))
        if (cmp !== 0) return s.dir === 'asc' ? cmp : -cmp
      }
      return a.order - b.order
    })
  } else {
    out = [...out].sort((a, b) => a.order - b.order)
  }
  return out
}

export interface KanbanGroup {
  /** id d'option, ou null pour "sans valeur". */
  optionId: string | null
  option: SelectOption | null
  rows: Page[]
}

/** Regroupe des lignes par propriété select (colonnes kanban). */
export function groupRows(rows: Page[], prop: PropertyDef): KanbanGroup[] {
  const groups: KanbanGroup[] = (prop.options ?? []).map((o) => ({ optionId: o.id, option: o, rows: [] }))
  const none: KanbanGroup = { optionId: null, option: null, rows: [] }
  for (const row of rows) {
    const v = propValue(row, prop.id)
    const optId = Array.isArray(v) ? v[0] : v
    const g = groups.find((g) => g.optionId === optId)
    if (g) g.rows.push(row)
    else none.rows.push(row)
  }
  return [none, ...groups]
}

/** Formatage d'affichage d'une valeur de propriété (pur, testable). */
export function formatPropValue(v: PropValue, prop: PropertyDef): string {
  if (isEmptyValue(v)) return ''
  switch (prop.type) {
    case 'checkbox': return v ? '✓' : ''
    case 'select': {
      const opt = prop.options?.find((o) => o.id === v)
      return opt?.name ?? String(v)
    }
    case 'multiSelect': {
      const ids = Array.isArray(v) ? v : [v]
      return ids.map((id) => prop.options?.find((o) => o.id === id)?.name ?? String(id)).join(', ')
    }
    case 'number': return String(v)
    default: return Array.isArray(v) ? v.join(', ') : String(v)
  }
}

/** Schéma par défaut d'une nouvelle base : Statut (select) + Échéance (date). */
export function defaultSchema(): DatabaseSchema {
  const statusProp: PropertyDef = {
    id: uid(),
    name: 'Statut',
    type: 'select',
    options: [
      { id: uid(), name: 'À faire', color: 'cat-gray' },
      { id: uid(), name: 'En cours', color: 'cat-blue' },
      { id: uid(), name: 'Terminé', color: 'cat-green' },
    ],
  }
  const dateProp: PropertyDef = { id: uid(), name: 'Échéance', type: 'date' }
  return {
    properties: [statusProp, dateProp],
    views: [
      { id: uid(), name: 'Tableau', type: 'table', filters: [], sorts: [] },
      { id: uid(), name: 'Kanban', type: 'kanban', filters: [], sorts: [], groupBy: statusProp.id },
      { id: uid(), name: 'Galerie', type: 'gallery', filters: [], sorts: [] },
    ],
  }
}
