import { useState } from 'react'
import type { Page, PropValue, ViewDef } from '../../core/types'
import { useStore } from '../../store/useStore'
import { groupRows } from '../../core/database'
import { catColor, PropertyDisplay } from './PropertyEditor'
import { IconPlus } from '../icons'

/** Vue kanban : colonnes = options de la propriété select `groupBy`, drag des cartes. */
export default function KanbanView({
  db, view, rows, onAddRow,
}: {
  db: Page
  view: ViewDef
  rows: Page[]
  onAddRow: (props?: Record<string, PropValue>) => string
}) {
  const pages = useStore((s) => s.data.pages)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const props = db.schema?.properties ?? []
  const groupProp = props.find((p) => p.id === view.groupBy && p.type === 'select')

  if (!groupProp) {
    return (
      <div className="col gap8" style={{ padding: 24, alignItems: 'flex-start' }}>
        <span className="caption">Le kanban a besoin d’une propriété de type «&nbsp;sélection&nbsp;» pour regrouper les cartes.</span>
        <div className="row gap8">
          {props.filter((p) => p.type === 'select').map((p) => (
            <button key={p.id} className="btn btn-sm btn-secondary" onClick={() => useStore.getState().updateView(db.id, view.id, { groupBy: p.id })}>
              Regrouper par «&nbsp;{p.name}&nbsp;»
            </button>
          ))}
        </div>
      </div>
    )
  }

  const groups = groupRows(rows, groupProp)
  const cardProps = props.filter((p) => p.id !== groupProp.id).slice(0, 3)

  return (
    <div className="kanban scroll" style={{ flex: 1, overflowY: 'auto' }}>
      {groups.map((g) => {
        const key = g.optionId ?? '__none'
        return (
          <div
            key={key}
            className="kanban-col"
            style={dragOverCol === key ? { outline: '1px solid var(--primary)', outlineOffset: 4, borderRadius: 'var(--r-md)' } : undefined}
            onDragOver={(e) => { e.preventDefault(); setDragOverCol(key) }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOverCol(null)
              const rowId = e.dataTransfer.getData('text/row-id')
              if (rowId) useStore.getState().setProp(rowId, groupProp.id, g.optionId)
            }}
          >
            <div className="kanban-col-head">
              {g.option
                ? <span className="badge"><span className="dot" style={{ background: catColor(g.option.color), width: 6, height: 6 }} />{g.option.name}</span>
                : <span className="badge">Sans {groupProp.name.toLowerCase()}</span>}
              <span className="caption mono">{g.rows.length}</span>
            </div>
            {g.rows.map((row) => (
              <div
                key={row.id}
                className="kcard"
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/row-id', row.id)}
                onClick={() => useStore.getState().setCurrentPage(row.id)}
              >
                <div className="subhead" style={{ marginBottom: cardProps.length ? 6 : 0 }}>
                  {row.icon ? `${row.icon} ` : ''}{row.title || 'Sans titre'}
                </div>
                <div className="col gap4">
                  {cardProps.map((p) => {
                    const v = row.props?.[p.id] ?? null
                    if (v === null || v === '' || (Array.isArray(v) && !v.length)) return null
                    return (
                      <span key={p.id} className="caption row gap6">
                        <PropertyDisplay prop={p} value={v} pages={pages} />
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
            <button
              className="btn btn-sm btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => onAddRow({ [groupProp.id]: g.optionId })}
            >
              <IconPlus width={13} height={13} /> Ajouter
            </button>
          </div>
        )
      })}
    </div>
  )
}
