import { useState } from 'react'
import type { Page } from '../../core/types'
import { useStore } from '../../store/useStore'
import PropertyEditor, { PropertyDisplay } from './PropertyEditor'
import { IconPlus, IconFile } from '../icons'

/** Vue tableau (DESIGN.md §6.9) : édition inline des cellules, titre → ouvre la page. */
export default function TableView({ db, rows, onAddRow }: { db: Page; rows: Page[]; onAddRow: () => void }) {
  const pages = useStore((s) => s.data.pages)
  const [editCell, setEditCell] = useState<{ rowId: string; propId: string } | null>(null)
  const props = db.schema?.properties ?? []

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ minWidth: 240 }}>Titre</th>
            {props.map((p) => <th key={p.id} style={{ minWidth: 140 }}>{p.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td onClick={() => useStore.getState().setCurrentPage(row.id)}>
                <span className="row gap8" style={{ color: 'var(--ink)' }}>
                  {row.icon ? <span>{row.icon}</span> : <IconFile width={13} height={13} style={{ color: 'var(--ink-tertiary)' }} />}
                  {row.title || 'Sans titre'}
                </span>
              </td>
              {props.map((p) => {
                const editing = editCell?.rowId === row.id && editCell.propId === p.id
                return (
                  <td
                    key={p.id}
                    className={p.type === 'number' ? 'num' : undefined}
                    onClick={() => setEditCell({ rowId: row.id, propId: p.id })}
                  >
                    {editing ? (
                      <div onBlur={() => setTimeout(() => setEditCell(null), 100)}>
                        <PropertyEditor
                          compact
                          prop={p}
                          value={row.props?.[p.id] ?? null}
                          pages={pages}
                          onChange={(v) => useStore.getState().setProp(row.id, p.id, v)}
                        />
                      </div>
                    ) : (
                      <PropertyDisplay prop={p} value={row.props?.[p.id] ?? null} pages={pages} />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
          <tr>
            <td colSpan={props.length + 1} onClick={onAddRow} style={{ color: 'var(--ink-tertiary)' }}>
              <span className="row gap6"><IconPlus width={13} height={13} /> Nouvelle ligne</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
