import * as XLSX from 'xlsx'
import type { Page, PropertyDef, PropValue } from './types'
import { formatPropValue, propValue } from './database'

/**
 * Import/export CSV-XLSX des bases de données (usage restreint de SheetJS,
 * comme documenté dans Patrimoine Manager — aucun autre usage du tableur).
 */

export interface ParsedTable {
  headers: string[]
  rows: string[][]
}

/** Parse un fichier CSV/XLSX (ArrayBuffer ou string CSV) en table brute. */
export function parseTable(data: ArrayBuffer | string): ParsedTable {
  const wb = typeof data === 'string' ? XLSX.read(data, { type: 'string' }) : XLSX.read(data, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
  const nonEmpty = aoa.filter((r) => r.some((c) => String(c).trim() !== ''))
  if (!nonEmpty.length) return { headers: [], rows: [] }
  return {
    headers: nonEmpty[0].map((h) => String(h).trim()),
    rows: nonEmpty.slice(1).map((r) => r.map((c) => String(c))),
  }
}

/** Sérialise des lignes de base en CSV (avec la colonne titre en tête). */
export function rowsToCsv(rows: Page[], properties: PropertyDef[]): string {
  const header = ['Titre', ...properties.map((p) => p.name)]
  const data = rows.map((row) => [
    row.title,
    ...properties.map((p) => formatPropValue(propValue(row, p.id), p)),
  ])
  const ws = XLSX.utils.aoa_to_sheet([header, ...data])
  return XLSX.utils.sheet_to_csv(ws)
}

/** Convertit une cellule CSV brute vers la valeur typée d'une propriété. */
export function coerceCell(raw: string, prop: PropertyDef): PropValue {
  const s = raw.trim()
  if (!s) return null
  switch (prop.type) {
    case 'number': {
      const n = Number(s.replace(',', '.'))
      return Number.isFinite(n) ? n : null
    }
    case 'checkbox': return /^(1|true|oui|x|✓)$/i.test(s)
    case 'select': {
      const opt = prop.options?.find((o) => o.name.toLowerCase() === s.toLowerCase())
      return opt ? opt.id : s
    }
    case 'multiSelect': {
      return s.split(/[;,]/).map((part) => {
        const t = part.trim()
        const opt = prop.options?.find((o) => o.name.toLowerCase() === t.toLowerCase())
        return opt ? opt.id : t
      }).filter(Boolean)
    }
    default: return s
  }
}
