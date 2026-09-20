import { useState } from 'react'
import type { Page, PropertyDef, PropertyType } from '../../core/types'
import { CATEGORY_COLORS } from '../../core/types'
import { useStore } from '../../store/useStore'
import { uid } from '../../core/id'
import { catColor } from './PropertyEditor'
import { IconPlus, IconTrash, IconX } from '../icons'

const TYPES: { id: PropertyType; label: string }[] = [
  { id: 'text', label: 'Texte' },
  { id: 'number', label: 'Nombre' },
  { id: 'date', label: 'Date' },
  { id: 'select', label: 'Sélection' },
  { id: 'multiSelect', label: 'Sélection multiple' },
  { id: 'checkbox', label: 'Case à cocher' },
  { id: 'relation', label: 'Relation' },
]

/** Gestion du schéma d'une base : propriétés custom, options de sélection, relations. */
export default function SchemaModal({ db, onClose }: { db: Page; onClose: () => void }) {
  const pages = useStore((s) => s.data.pages)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<PropertyType>('text')
  const props = db.schema?.properties ?? []
  const databases = pages.filter((p) => p.kind === 'database')

  function addProp() {
    const name = newName.trim()
    if (!name) return
    const prop: PropertyDef = { id: uid(), name, type: newType }
    if (newType === 'select' || newType === 'multiSelect') prop.options = []
    if (newType === 'relation') prop.relationTarget = databases[0]?.id
    useStore.getState().addProperty(db.id, prop)
    setNewName('')
  }

  function addOption(prop: PropertyDef) {
    const name = window.prompt('Nom de l’option :')
    if (!name?.trim()) return
    const color = CATEGORY_COLORS[(prop.options?.length ?? 0) % CATEGORY_COLORS.length]
    useStore.getState().updateProperty(db.id, prop.id, {
      options: [...(prop.options ?? []), { id: uid(), name: name.trim(), color }],
    })
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" style={{ width: 560 }}>
        <div className="subhead-bar spread">
          <span className="subhead">Propriétés — {db.title || 'base'}</span>
          <button className="btn btn-icon btn-sm btn-ghost" onClick={onClose}><IconX width={14} height={14} /></button>
        </div>
        <div className="scroll col gap10" style={{ padding: 16 }}>
          {props.map((p) => (
            <div key={p.id} className="panel-flush col gap8" style={{ padding: 10 }}>
              <div className="row gap8">
                <input
                  className="input" style={{ width: 180 }}
                  value={p.name}
                  onChange={(e) => useStore.getState().updateProperty(db.id, p.id, { name: e.target.value })}
                />
                <span className="badge">{TYPES.find((t) => t.id === p.type)?.label}</span>
                {p.type === 'relation' && (
                  <select
                    style={{ height: 28, fontSize: 12.5 }}
                    value={p.relationTarget ?? ''}
                    onChange={(e) => useStore.getState().updateProperty(db.id, p.id, { relationTarget: e.target.value })}
                  >
                    {databases.map((d) => <option key={d.id} value={d.id}>{d.title || 'Sans titre'}</option>)}
                  </select>
                )}
                <span style={{ flex: 1 }} />
                <button
                  className="btn btn-icon btn-sm btn-danger-ghost"
                  title="Supprimer la propriété"
                  onClick={() => {
                    if (window.confirm(`Supprimer la propriété « ${p.name} » ? Les valeurs existantes seront ignorées.`)) {
                      useStore.getState().removeProperty(db.id, p.id)
                    }
                  }}
                >
                  <IconTrash width={13} height={13} />
                </button>
              </div>
              {(p.type === 'select' || p.type === 'multiSelect') && (
                <div className="row gap6" style={{ flexWrap: 'wrap' }}>
                  {(p.options ?? []).map((o) => (
                    <span key={o.id} className="chip" style={{ cursor: 'default' }}>
                      <span className="dot" style={{ background: catColor(o.color), width: 6, height: 6 }} />
                      {o.name}
                      <span
                        style={{ cursor: 'pointer', display: 'inline-flex', color: 'var(--ink-tertiary)' }}
                        title="Supprimer l’option"
                        onClick={() => useStore.getState().updateProperty(db.id, p.id, { options: (p.options ?? []).filter((x) => x.id !== o.id) })}
                      >
                        <IconX width={10} height={10} />
                      </span>
                    </span>
                  ))}
                  <button className="chip" onClick={() => addOption(p)}>
                    <IconPlus width={11} height={11} /> Option
                  </button>
                </div>
              )}
            </div>
          ))}

          <div className="row gap8" style={{ marginTop: 4 }}>
            <input
              className="input" style={{ flex: 1 }} placeholder="Nouvelle propriété…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addProp()}
            />
            <select style={{ width: 160 }} value={newType} onChange={(e) => setNewType(e.target.value as PropertyType)}>
              {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <button className="btn btn-secondary" onClick={addProp} disabled={!newName.trim()}>
              <IconPlus width={13} height={13} /> Ajouter
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
