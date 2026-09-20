import { useState } from 'react'
import type { Page, PropValue } from '../../core/types'
import { useStore } from '../../store/useStore'
import PropertyEditor from './PropertyEditor'
import { useToast } from '../Toast'
import { IconX } from '../icons'

/** Mode formulaire (CLAUDE.md §5.8) : saisie guidée d'une nouvelle entrée. */
export default function FormModal({ db, onClose }: { db: Page; onClose: () => void }) {
  const pages = useStore((s) => s.data.pages)
  const [title, setTitle] = useState('')
  const [values, setValues] = useState<Record<string, PropValue>>({})
  const show = useToast((s) => s.show)
  const props = db.schema?.properties ?? []

  function submit(openAfter: boolean) {
    const store = useStore.getState()
    const id = store.createPage(db.id, 'page', title.trim())
    for (const [propId, v] of Object.entries(values)) {
      if (v !== null && v !== undefined) store.setProp(id, propId, v)
    }
    show('Entrée créée')
    if (openAfter) { store.setCurrentPage(id); onClose() }
    else { setTitle(''); setValues({}) }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal">
        <div className="subhead-bar spread">
          <span className="subhead">Nouvelle entrée — {db.title || 'base'}</span>
          <button className="btn btn-icon btn-sm btn-ghost" onClick={onClose}><IconX width={14} height={14} /></button>
        </div>
        <div className="scroll col gap12" style={{ padding: 16 }}>
          <label className="col gap6">
            <span className="kpi-label">Titre</span>
            <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de l’entrée" />
          </label>
          {props.map((p) => (
            <label key={p.id} className="col gap6">
              <span className="kpi-label">{p.name}</span>
              <PropertyEditor
                prop={p}
                value={values[p.id] ?? null}
                pages={pages}
                onChange={(v) => setValues((s) => ({ ...s, [p.id]: v }))}
              />
            </label>
          ))}
        </div>
        <div className="row gap8" style={{ padding: 16, justifyContent: 'flex-end', borderTop: '1px solid var(--hairline)' }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-secondary" onClick={() => submit(false)}>Créer et continuer</button>
          <button className="btn btn-primary" onClick={() => submit(true)}>Créer</button>
        </div>
      </div>
    </>
  )
}
