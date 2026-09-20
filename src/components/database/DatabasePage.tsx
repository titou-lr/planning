import { useMemo, useState } from 'react'
import type { Filter, FilterOp, Page, PropertyDef, SelectOption, ViewDef } from '../../core/types'
import { CATEGORY_COLORS } from '../../core/types'
import { useStore } from '../../store/useStore'
import { childrenOf } from '../../core/tree'
import { applyView } from '../../core/database'
import { parseTable, rowsToCsv, coerceCell } from '../../core/csvio'
import { downloadFile, pickFile } from '../../store/exportImport'
import { uid } from '../../core/id'
import { useToast } from '../Toast'
import TableView from './TableView'
import KanbanView from './KanbanView'
import GalleryView from './GalleryView'
import DbCalendarView from './DbCalendarView'
import FormModal from './FormModal'
import SchemaModal from './SchemaModal'
import { IconPlus, IconTable, IconKanban, IconGallery, IconForm, IconSettings, IconDownload, IconUpload, IconTrash, IconX, IconCalendar } from '../icons'

const OPS: { id: FilterOp; label: string }[] = [
  { id: 'equals', label: '=' },
  { id: 'notEquals', label: '≠' },
  { id: 'contains', label: 'contient' },
  { id: 'isEmpty', label: 'vide' },
  { id: 'isNotEmpty', label: 'non vide' },
  { id: 'gt', label: '>' },
  { id: 'lt', label: '<' },
]

function viewIcon(type: ViewDef['type']) {
  if (type === 'kanban') return <IconKanban width={13} height={13} />
  if (type === 'gallery') return <IconGallery width={13} height={13} />
  if (type === 'calendar') return <IconCalendar width={13} height={13} />
  return <IconTable width={13} height={13} />
}

export default function DatabasePage({ db }: { db: Page }) {
  const pages = useStore((s) => s.data.pages)
  const activeViewMap = useStore((s) => s.activeView)
  const [formOpen, setFormOpen] = useState(false)
  const [schemaOpen, setSchemaOpen] = useState(false)
  const [controlsOpen, setControlsOpen] = useState(false)
  const show = useToast((s) => s.show)

  const schema = db.schema ?? { properties: [], views: [] }
  const view = schema.views.find((v) => v.id === activeViewMap[db.id]) ?? schema.views[0]
  const allRows = useMemo(() => childrenOf(pages, db.id), [pages, db.id])
  const rows = useMemo(() => (view ? applyView(allRows, view) : allRows), [allRows, view])

  function addRow(extraProps?: Record<string, import('../../core/types').PropValue>) {
    const store = useStore.getState()
    const id = store.createPage(db.id, 'page', '')
    if (extraProps) {
      for (const [propId, v] of Object.entries(extraProps)) store.setProp(id, propId, v)
    }
    return id
  }

  function exportCsv() {
    downloadFile(`${db.title || 'base'}.csv`, rowsToCsv(rows, schema.properties), 'text/csv')
    show('Vue exportée en CSV')
  }

  async function importCsv() {
    const file = await pickFile('.csv')
    if (!file) return
    const { headers, rows: raw } = parseTable(file.text)
    if (!headers.length) { show('Fichier CSV vide ou illisible'); return }
    const store = useStore.getState()
    // Mappe les colonnes sur les propriétés existantes par nom ; crée en texte sinon
    const colProps: (PropertyDef | 'title' | null)[] = headers.map((h, i) => {
      if (i === 0 && /^(titre|title|nom|name)$/i.test(h)) return 'title'
      const existing = schema.properties.find((p) => p.name.toLowerCase() === h.toLowerCase())
      if (existing) return existing
      const created: PropertyDef = { id: uid(), name: h, type: 'text' }
      store.addProperty(db.id, created)
      return created
    })
    // Colonnes select/multiSelect : crée les options manquantes plutôt que
    // de stocker des libellés orphelins (valeurs censées être des ids d'option)
    colProps.forEach((cp, i) => {
      if (!cp || cp === 'title' || (cp.type !== 'select' && cp.type !== 'multiSelect')) return
      const known = new Set((cp.options ?? []).map((o) => o.name.toLowerCase()))
      const added: SelectOption[] = []
      for (const r of raw) {
        const parts = cp.type === 'multiSelect' ? (r[i] ?? '').split(/[;,]/) : [r[i] ?? '']
        for (const part of parts) {
          const t = part.trim()
          if (t && !known.has(t.toLowerCase())) {
            known.add(t.toLowerCase())
            added.push({
              id: uid(), name: t,
              color: CATEGORY_COLORS[((cp.options?.length ?? 0) + added.length) % CATEGORY_COLORS.length],
            })
          }
        }
      }
      if (added.length) {
        const options = [...(cp.options ?? []), ...added]
        store.updateProperty(db.id, cp.id, { options })
        colProps[i] = { ...cp, options }
      }
    })
    for (const r of raw) {
      const title = colProps[0] === 'title' ? (r[0] ?? '') : ''
      const id = store.createPage(db.id, 'page', title)
      r.forEach((cell, i) => {
        const cp = colProps[i]
        if (cp && cp !== 'title') store.setProp(id, cp.id, coerceCell(cell, cp))
      })
    }
    show(`${raw.length} ligne${raw.length > 1 ? 's' : ''} importée${raw.length > 1 ? 's' : ''} depuis CSV`)
  }

  function updateFilters(fn: (filters: Filter[]) => Filter[]) {
    if (view) useStore.getState().updateView(db.id, view.id, { filters: fn(view.filters) })
  }

  if (!view) return <div className="col" style={{ padding: 24 }}><span className="caption">Base sans vue — schéma corrompu.</span></div>

  return (
    <div className="col" style={{ flex: 1, overflow: 'hidden' }}>
      <div className="subhead-bar no-print">
        <input
          className="title"
          style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink)', width: 220, fontFamily: 'var(--font-ui)' }}
          value={db.title}
          placeholder="Nom de la base"
          onChange={(e) => useStore.getState().renamePage(db.id, e.target.value)}
        />
        <div className="seg">
          {schema.views.map((v) => (
            <button key={v.id} className={v.id === view.id ? 'on' : ''} onClick={() => useStore.getState().setActiveView(db.id, v.id)}>
              <span className="row gap6">{viewIcon(v.type)}{v.name}</span>
            </button>
          ))}
        </div>
        <button
          className="btn btn-icon btn-sm btn-ghost" title="Ajouter une vue"
          onClick={() => {
            const type = window.prompt('Type de vue : table / kanban / gallery / calendar', 'table')
            if (!type || !['table', 'kanban', 'gallery', 'calendar'].includes(type)) return
            const groupBy = type === 'kanban' ? schema.properties.find((p) => p.type === 'select')?.id : undefined
            const dateProp = type === 'calendar' ? schema.properties.find((p) => p.type === 'date')?.id : undefined
            useStore.getState().addView(db.id, {
              id: uid(),
              name: type === 'table' ? 'Tableau' : type === 'kanban' ? 'Kanban' : type === 'gallery' ? 'Galerie' : 'Calendrier',
              type: type as ViewDef['type'], filters: [], sorts: [], groupBy, dateProp,
            })
          }}
        >
          <IconPlus width={13} height={13} />
        </button>
        <span style={{ flex: 1 }} />
        <button className={`chip${controlsOpen || view.filters.length || view.sorts.length ? ' chip-active' : ''}`} onClick={() => setControlsOpen((v) => !v)}>
          Filtres {view.filters.length ? `(${view.filters.length})` : ''} · Tri {view.sorts.length ? `(${view.sorts.length})` : ''}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => setSchemaOpen(true)} title="Propriétés de la base">
          <IconSettings width={13} height={13} /> Propriétés
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => setFormOpen(true)} title="Créer via formulaire">
          <IconForm width={13} height={13} /> Formulaire
        </button>
        <button className="btn btn-icon btn-sm btn-ghost" onClick={importCsv} title="Importer CSV"><IconUpload width={13} height={13} /></button>
        <button className="btn btn-icon btn-sm btn-ghost" onClick={exportCsv} title="Exporter CSV"><IconDownload width={13} height={13} /></button>
        <button
          className="btn btn-icon btn-sm btn-danger-ghost" title="Supprimer la base"
          onClick={() => {
            if (window.confirm(`Supprimer la base « ${db.title} » et ses ${allRows.length} lignes ?`)) {
              useStore.getState().deletePage(db.id)
            }
          }}
        >
          <IconTrash width={13} height={13} />
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => useStore.getState().setCurrentPage(addRow())}>
          <IconPlus width={13} height={13} /> Nouveau
        </button>
      </div>

      {controlsOpen && (
        <div className="row gap8 no-print" style={{ padding: '8px 16px', borderBottom: '1px solid var(--hairline)', flexWrap: 'wrap' }}>
          {view.filters.map((f, i) => {
            const prop = schema.properties.find((p) => p.id === f.propId)
            return (
              <span key={i} className="chip chip-active" style={{ gap: 4 }}>
                {f.propId === '__title' ? 'Titre' : prop?.name ?? '?'} {OPS.find((o) => o.id === f.op)?.label}
                {!['isEmpty', 'isNotEmpty'].includes(f.op) && (
                  <input
                    className="input" style={{ height: 20, width: 90, fontSize: 12 }}
                    value={String(f.value ?? '')}
                    onChange={(e) => updateFilters((fs) => fs.map((x, j) => (j === i ? { ...x, value: prop?.type === 'number' ? Number(e.target.value) : e.target.value } : x)))}
                  />
                )}
                <span onClick={() => updateFilters((fs) => fs.filter((_, j) => j !== i))} style={{ cursor: 'pointer', display: 'inline-flex' }}><IconX width={11} height={11} /></span>
              </span>
            )
          })}
          <select
            style={{ height: 26, fontSize: 12.5 }}
            value=""
            onChange={(e) => {
              if (!e.target.value) return
              updateFilters((fs) => [...fs, { propId: e.target.value, op: 'contains', value: '' }])
            }}
          >
            <option value="">+ Filtre…</option>
            <option value="__title">Titre</option>
            {schema.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {view.filters.length > 0 && (
            <select
              style={{ height: 26, fontSize: 12.5 }}
              value={view.filters[view.filters.length - 1].op}
              onChange={(e) => updateFilters((fs) => fs.map((x, j) => (j === fs.length - 1 ? { ...x, op: e.target.value as FilterOp } : x)))}
              title="Opérateur du dernier filtre"
            >
              {OPS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          )}
          <span className="vdivider" />
          {view.sorts.map((s, i) => {
            const prop = schema.properties.find((p) => p.id === s.propId)
            return (
              <span key={i} className="chip chip-active" style={{ gap: 4 }}>
                ↕ {s.propId === '__title' ? 'Titre' : prop?.name ?? '?'} {s.dir === 'asc' ? '↑' : '↓'}
                <span
                  onClick={() => useStore.getState().updateView(db.id, view.id, { sorts: view.sorts.map((x, j) => (j === i ? { ...x, dir: x.dir === 'asc' ? 'desc' : 'asc' } : x)) })}
                  style={{ cursor: 'pointer' }}
                >⇄</span>
                <span onClick={() => useStore.getState().updateView(db.id, view.id, { sorts: view.sorts.filter((_, j) => j !== i) })} style={{ cursor: 'pointer', display: 'inline-flex' }}><IconX width={11} height={11} /></span>
              </span>
            )
          })}
          <select
            style={{ height: 26, fontSize: 12.5 }}
            value=""
            onChange={(e) => {
              if (!e.target.value) return
              useStore.getState().updateView(db.id, view.id, { sorts: [...view.sorts, { propId: e.target.value, dir: 'asc' }] })
            }}
          >
            <option value="">+ Tri…</option>
            <option value="__title">Titre</option>
            {schema.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {view.type === 'table' && <TableView db={db} rows={rows} onAddRow={() => addRow()} />}
      {view.type === 'kanban' && <KanbanView db={db} view={view} rows={rows} onAddRow={addRow} />}
      {view.type === 'gallery' && <GalleryView db={db} rows={rows} view={view} />}
      {view.type === 'calendar' && <DbCalendarView db={db} view={view} rows={rows} onAddRow={addRow} />}

      {formOpen && <FormModal db={db} onClose={() => setFormOpen(false)} />}
      {schemaOpen && <SchemaModal db={db} onClose={() => setSchemaOpen(false)} />}
    </div>
  )
}

export { CATEGORY_COLORS }
