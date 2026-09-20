import type { Page, ViewDef } from '../../core/types'
import { useStore } from '../../store/useStore'
import { PropertyDisplay } from './PropertyEditor'
import { blocksToMarkdown } from '../../core/markdown'

/** Vue galerie : grille de cartes avec aperçu du contenu et propriétés. */
export default function GalleryView({ db, rows }: { db: Page; rows: Page[]; view: ViewDef }) {
  const pages = useStore((s) => s.data.pages)
  const props = (db.schema?.properties ?? []).slice(0, 3)

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div className="gallery">
        {rows.map((row) => {
          const preview = blocksToMarkdown(row.blocks).replace(/[#>*`\-|]/g, '').trim().slice(0, 140)
          return (
            <div key={row.id} className="gcard col gap8" onClick={() => useStore.getState().setCurrentPage(row.id)}>
              <span className="subhead">{row.icon ? `${row.icon} ` : ''}{row.title || 'Sans titre'}</span>
              {preview && <span className="caption" style={{ overflow: 'hidden', maxHeight: 54 }}>{preview}</span>}
              <div className="col gap4">
                {props.map((p) => {
                  const v = row.props?.[p.id] ?? null
                  if (v === null || v === '' || (Array.isArray(v) && !v.length)) return null
                  return (
                    <span key={p.id} className="caption row gap6">
                      <span className="kpi-label">{p.name}</span>
                      <PropertyDisplay prop={p} value={v} pages={pages} />
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
        {rows.length === 0 && <span className="caption">Aucune entrée dans cette vue.</span>}
      </div>
    </div>
  )
}
