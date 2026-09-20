import { useMemo, useState } from 'react'
import type { Page, ViewDef } from '../../core/types'
import { useStore } from '../../store/useStore'
import { propValue } from '../../core/database'
import { toDateKey } from '../../core/recurrence'
import { IconChevron, IconPlus } from '../icons'

/**
 * Vue calendrier d'une base (§5.3) : les entrées sont placées sur un mois
 * selon une propriété date choisie. Même donnée que les autres vues,
 * aucune duplication.
 */

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export default function DbCalendarView({
  db, view, rows, onAddRow,
}: {
  db: Page
  view: ViewDef
  rows: Page[]
  onAddRow: (props?: Record<string, string>) => string
}) {
  const schema = db.schema ?? { properties: [], views: [] }
  const dateProps = schema.properties.filter((p) => p.type === 'date')
  const dateProp = dateProps.find((p) => p.id === view.dateProp) ?? dateProps[0]
  const [month, setMonth] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })

  const byDay = useMemo(() => {
    const m = new Map<string, Page[]>()
    if (!dateProp) return m
    for (const r of rows) {
      const v = propValue(r, dateProp.id)
      if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) continue
      const key = v.slice(0, 10)
      m.set(key, [...(m.get(key) ?? []), r])
    }
    return m
  }, [rows, dateProp])

  if (!dateProp) {
    return (
      <div className="col gap8" style={{ padding: 24 }}>
        <span className="caption">
          Cette vue nécessite une propriété de type « date » — ajoute-en une via « Propriétés ».
        </span>
      </div>
    )
  }

  // Grille du mois : premières cases = lundi de la semaine du 1er
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = new Date(firstDay)
  start.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7))
  const cells: Date[] = []
  for (let i = 0; i < 42; i++) cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  const todayKey = toDateKey(new Date())

  return (
    <div className="col scroll" style={{ flex: 1, padding: 16 }}>
      <div className="row gap8" style={{ marginBottom: 10 }}>
        <button className="btn btn-icon btn-sm btn-ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          <IconChevron style={{ transform: 'rotate(180deg)' }} />
        </button>
        <span className="subhead" style={{ width: 150, textAlign: 'center' }}>
          {month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </span>
        <button className="btn btn-icon btn-sm btn-ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          <IconChevron />
        </button>
        <span style={{ flex: 1 }} />
        {dateProps.length > 1 && (
          <select
            style={{ height: 26, fontSize: 12.5 }}
            value={dateProp.id}
            onChange={(e) => useStore.getState().updateView(db.id, view.id, { dateProp: e.target.value })}
            title="Propriété date utilisée"
          >
            {dateProps.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: 'var(--hairline)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        {WEEKDAYS.map((d) => (
          <div key={d} className="eyebrow" style={{ background: 'var(--surface-1)', padding: '6px 8px', color: 'var(--ink-tertiary)' }}>{d}</div>
        ))}
        {cells.map((d) => {
          const key = toDateKey(d)
          const inMonth = d.getMonth() === month.getMonth()
          const items = byDay.get(key) ?? []
          return (
            <div
              key={key}
              className="col gap4"
              style={{
                background: 'var(--canvas)', minHeight: 92, padding: 6,
                opacity: inMonth ? 1 : 0.45,
              }}
            >
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="caption mono" style={key === todayKey ? { color: 'var(--primary-hover)', fontWeight: 600 } : undefined}>
                  {d.getDate()}
                </span>
                <button
                  className="btn btn-icon btn-sm btn-ghost cal-add no-print"
                  style={{ width: 18, height: 18 }}
                  title="Nouvelle entrée à cette date"
                  onClick={() => useStore.getState().setCurrentPage(onAddRow({ [dateProp.id]: key }))}
                >
                  <IconPlus width={10} height={10} />
                </button>
              </div>
              {items.map((r) => (
                <button
                  key={r.id}
                  className="chip"
                  style={{ height: 'auto', padding: '2px 7px', fontSize: 11.5, justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={() => useStore.getState().setCurrentPage(r.id)}
                >
                  {r.icon ? `${r.icon} ` : ''}{r.title || '(sans titre)'}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
