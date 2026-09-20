import { useMemo, useState } from 'react'
import type { Page } from '../core/types'
import { useStore } from '../store/useStore'
import { buildBacklinkIndex } from '../core/links'
import { findPage } from '../core/tree'
import { pageToMarkdown } from '../core/markdown'
import { downloadFile } from '../store/exportImport'
import { useToast } from './Toast'
import BlockEditor from './editor/BlockEditor'
import HistoryPanel from './HistoryPanel'
import PropertyEditor from './database/PropertyEditor'
import { IconClock, IconDownload, IconLink, IconTemplate, IconTrash, IconPlus, IconFile } from './icons'

export default function PageView({ page }: { page: Page }) {
  const pages = useStore((s) => s.data.pages)
  const [historyOpen, setHistoryOpen] = useState(false)
  const show = useToast((s) => s.show)

  const backlinks = useMemo(() => {
    const ids = buildBacklinkIndex(pages).get(page.id) ?? []
    return ids.map((id) => findPage(pages, id)).filter((p): p is Page => Boolean(p))
  }, [pages, page.id])

  const parent = page.parentId ? findPage(pages, page.parentId) : undefined
  const parentDb = parent?.kind === 'database' ? parent : undefined

  function exportMd() {
    downloadFile(`${page.title || 'page'}.md`, pageToMarkdown(page), 'text/markdown')
    show('Page exportée en Markdown')
  }

  function exportPdf() {
    // Export PDF via impression système (CSS print DESIGN.md §10)
    window.print()
  }

  function makeTemplate() {
    useStore.getState().insertPage({
      id: crypto.randomUUID(),
      title: page.title || 'Sans titre',
      parentId: null,
      kind: 'template',
      blocks: JSON.parse(JSON.stringify(page.blocks)),
    })
    show('Template créé à partir de cette page')
  }

  function deletePage() {
    if (window.confirm(`Supprimer « ${page.title || 'Sans titre'} » et toutes ses sous-pages ?`)) {
      useStore.getState().deletePage(page.id)
    }
  }

  return (
    <div className="row" style={{ flex: 1, overflow: 'hidden', alignItems: 'stretch' }}>
      <div className="scroll" style={{ flex: 1 }}>
        <div className="print-header">
          <span className="title">{page.title || 'Sans titre'}</span>
          <span className="caption mono">{new Date().toLocaleDateString('fr-FR')}</span>
        </div>
        <div className="col" style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 0' }}>
          <div className="row gap8 no-print" style={{ marginBottom: 4 }}>
            <button
              className="btn btn-sm btn-ghost"
              title="Changer l’icône"
              onClick={() => {
                const icon = window.prompt('Emoji d’icône (vide pour retirer) :', page.icon ?? '')
                if (icon !== null) useStore.getState().setPageIcon(page.id, icon.trim())
              }}
            >
              {page.icon || <IconFile width={14} height={14} />}
            </button>
            <span style={{ flex: 1 }} />
            <button className="btn btn-sm btn-ghost" onClick={() => setHistoryOpen((v) => !v)} title="Historique de versions">
              <IconClock width={13} height={13} /> Historique
            </button>
            <button className="btn btn-sm btn-ghost" onClick={makeTemplate} title="Enregistrer comme template">
              <IconTemplate width={13} height={13} />
            </button>
            <button className="btn btn-sm btn-ghost" onClick={exportMd} title="Exporter en Markdown">
              <IconDownload width={13} height={13} /> MD
            </button>
            <button className="btn btn-sm btn-ghost" onClick={exportPdf} title="Exporter en PDF (imprimer)">
              <IconDownload width={13} height={13} /> PDF
            </button>
            <button className="btn btn-icon btn-sm btn-danger-ghost" onClick={deletePage} title="Supprimer la page">
              <IconTrash width={13} height={13} />
            </button>
          </div>

          <input
            className="display"
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--ink)', padding: 0, marginBottom: 8, fontFamily: 'var(--font-ui)',
            }}
            value={page.title}
            placeholder="Sans titre"
            onChange={(e) => useStore.getState().renamePage(page.id, e.target.value)}
          />

          {parentDb?.schema && (
            <div className="panel-flush col gap8 no-print" style={{ padding: 12, marginBottom: 16 }}>
              {parentDb.schema.properties.map((prop) => (
                <div key={prop.id} className="row gap10">
                  <span className="kpi-label" style={{ width: 120, flex: 'none' }}>{prop.name}</span>
                  <PropertyEditor
                    prop={prop}
                    value={page.props?.[prop.id] ?? null}
                    pages={pages}
                    onChange={(v) => useStore.getState().setProp(page.id, prop.id, v)}
                  />
                </div>
              ))}
            </div>
          )}

          <BlockEditor page={page} />

          {backlinks.length > 0 && (
            <div className="col gap6 no-print" style={{ margin: '24px 0 60px' }}>
              <hr className="divider" />
              <span className="eyebrow" style={{ color: 'var(--ink-tertiary)', marginTop: 8 }}>
                <IconLink width={11} height={11} style={{ verticalAlign: -1, marginRight: 5 }} />
                Mentionnée par {backlinks.length} page{backlinks.length > 1 ? 's' : ''}
              </span>
              {backlinks.map((b) => (
                <button key={b.id} className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => useStore.getState().setCurrentPage(b.id)}>
                  <IconFile width={13} height={13} /> {b.title || 'Sans titre'}
                </button>
              ))}
            </div>
          )}

          {page.kind === 'template' && (
            <div className="row gap8 no-print" style={{ margin: '16px 0 60px' }}>
              <span className="badge badge-accent">Template</span>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  const id = useStore.getState().createFromTemplate(page.id, null)
                  if (id) useStore.getState().setCurrentPage(id)
                }}
              >
                <IconPlus width={13} height={13} /> Créer une page depuis ce template
              </button>
            </div>
          )}
        </div>
      </div>
      {historyOpen && <HistoryPanel page={page} onClose={() => setHistoryOpen(false)} />}
    </div>
  )
}
