import type { Page, PropertyDef, PropValue } from '../../core/types'
import { childrenOf, findPage } from '../../core/tree'

export function catColor(token: string): string {
  return `var(--${token})`
}

/** Éditeur d'une valeur de propriété, selon son type. Contrôlé, sans logique métier. */
export default function PropertyEditor({
  prop, value, onChange, pages, compact = false,
}: {
  prop: PropertyDef
  value: PropValue
  onChange: (v: PropValue) => void
  pages: Page[]
  compact?: boolean
}) {
  const h = compact ? 28 : 32

  switch (prop.type) {
    case 'text':
      return (
        <input
          className="input" style={{ height: h }}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      )
    case 'number':
      return (
        <input
          className="input mono" type="number" style={{ height: h }}
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      )
    case 'date':
      return (
        <input
          className="input mono" type="date" style={{ height: h }}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      )
    case 'checkbox':
      return (
        <input
          type="checkbox" className="todo-check" style={{ margin: 0 }}
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
      )
    case 'select':
      return (
        <select
          style={{ height: h, width: '100%' }}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">—</option>
          {(prop.options ?? []).map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      )
    case 'multiSelect': {
      const selected = Array.isArray(value) ? value : []
      return (
        <div className="row gap4" style={{ flexWrap: 'wrap' }}>
          {(prop.options ?? []).map((o) => {
            const on = selected.includes(o.id)
            return (
              <button
                key={o.id}
                className={`chip${on ? ' chip-active' : ''}`}
                style={{ height: compact ? 22 : 26 }}
                onClick={() => onChange(on ? selected.filter((x) => x !== o.id) : [...selected, o.id])}
              >
                <span className="dot" style={{ background: catColor(o.color), width: 6, height: 6 }} />
                {o.name}
              </button>
            )
          })}
        </div>
      )
    }
    case 'relation': {
      const targets = prop.relationTarget ? childrenOf(pages, prop.relationTarget) : []
      const targetDb = prop.relationTarget ? findPage(pages, prop.relationTarget) : undefined
      return (
        <select
          style={{ height: h, width: '100%' }}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
          title={targetDb ? `Relation vers « ${targetDb.title} »` : 'Relation'}
        >
          <option value="">—</option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>{t.title || 'Sans titre'}</option>
          ))}
        </select>
      )
    }
    default:
      return <span className="caption">Type inconnu</span>
  }
}

/** Affichage lecture seule d'une valeur (badges colorés pour les selects). */
export function PropertyDisplay({ prop, value, pages }: { prop: PropertyDef; value: PropValue; pages: Page[] }) {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) {
    return <span className="caption">—</span>
  }
  switch (prop.type) {
    case 'checkbox':
      return <span style={{ color: value ? 'var(--success)' : 'var(--ink-tertiary)' }}>{value ? '✓' : '—'}</span>
    case 'select': {
      const o = prop.options?.find((x) => x.id === value)
      if (!o) return <span className="caption">{String(value)}</span>
      return (
        <span className="badge">
          <span className="dot" style={{ background: catColor(o.color), width: 6, height: 6 }} />
          {o.name}
        </span>
      )
    }
    case 'multiSelect': {
      const ids = Array.isArray(value) ? value : [value]
      return (
        <span className="row gap4" style={{ flexWrap: 'wrap' }}>
          {ids.map((id) => {
            const o = prop.options?.find((x) => x.id === id)
            return (
              <span key={String(id)} className="badge">
                {o && <span className="dot" style={{ background: catColor(o.color), width: 6, height: 6 }} />}
                {o?.name ?? String(id)}
              </span>
            )
          })}
        </span>
      )
    }
    case 'relation': {
      const target = pages.find((p) => p.id === value)
      return <span className="page-link">{target?.title ?? '(supprimée)'}</span>
    }
    case 'number':
      return <span className="mono">{String(value)}</span>
    case 'date':
      return <span className="mono">{String(value)}</span>
    default:
      return <span>{Array.isArray(value) ? value.join(', ') : String(value)}</span>
  }
}
