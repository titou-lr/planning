import { useMemo } from 'react'
import type { Block, Page } from '../core/types'
import { useStore } from '../store/useStore'
import { childrenOf } from '../core/tree'
import { formatPropValue, propValue } from '../core/database'
import RenderInline from './editor/RenderInline'
import { IconX } from './icons'

/**
 * Export PDF de l'espace complet (§5.9) : rendu lecture seule de toutes
 * les pages dans l'ordre de l'arborescence, puis impression système
 * (comme l'export PDF d'une page). Sans limite de volume.
 */

function flattenTree(pages: Page[]): Page[] {
  const out: Page[] = []
  function walk(parentId: string | null) {
    for (const p of childrenOf(pages, parentId)) {
      if (p.kind !== 'template') out.push(p)
      walk(p.id)
    }
  }
  walk(null)
  return out
}

function PrintBlock({ block }: { block: Block }) {
  const pad = { paddingLeft: (block.indent ?? 0) * 20 }
  switch (block.type) {
    case 'heading1': return <h2 className="title" style={{ margin: '12px 0 4px' }}><RenderInline text={block.text} /></h2>
    case 'heading2': return <h3 className="heading" style={{ margin: '10px 0 3px' }}><RenderInline text={block.text} /></h3>
    case 'heading3': return <h4 className="subhead" style={{ margin: '8px 0 2px' }}><RenderInline text={block.text} /></h4>
    case 'bulleted': return <div style={pad}>• <RenderInline text={block.text} /></div>
    case 'numbered': return <div style={pad}>1. <RenderInline text={block.text} /></div>
    case 'todo': return <div style={pad}>{block.checked ? '☑' : '☐'} <RenderInline text={block.text} /></div>
    case 'quote': return <blockquote style={{ borderLeft: '2px solid var(--hairline-strong)', margin: '4px 0', paddingLeft: 10, color: 'var(--ink-subtle)' }}><RenderInline text={block.text} /></blockquote>
    case 'code': return <pre className="mono" style={{ background: 'var(--surface-1)', padding: 8, borderRadius: 6, fontSize: 12, whiteSpace: 'pre-wrap' }}>{block.text}</pre>
    case 'divider': return <hr className="divider" style={{ margin: '10px 0' }} />
    case 'image': return block.src ? <img src={block.src} alt={block.text} style={{ maxWidth: '100%' }} /> : null
    case 'table': return (
      <table style={{ borderCollapse: 'collapse', margin: '6px 0' }}>
        <tbody>
          {(block.rows ?? []).map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={{ border: '1px solid var(--hairline)', padding: '3px 8px', fontSize: 13 }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
    default: return <p style={{ margin: '2px 0' }}><RenderInline text={block.text} /></p>
  }
}

export default function PrintSpace({ onClose }: { onClose: () => void }) {
  const pages = useStore((s) => s.data.pages)
  const ordered = useMemo(() => flattenTree(pages), [pages])

  return (
    <div className="modal-full print-space scroll" style={{ padding: '24px 0' }}>
      <div className="row gap8 no-print" style={{ maxWidth: 760, margin: '0 auto 16px', padding: '0 24px' }}>
        <span className="subhead" style={{ flex: 1 }}>Aperçu de l’espace complet ({ordered.length} pages)</span>
        <button className="btn btn-primary" onClick={() => window.print()}>Imprimer / PDF</button>
        <button className="btn btn-icon btn-ghost" onClick={onClose}><IconX width={14} height={14} /></button>
      </div>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
        {ordered.map((p) => (
          <section key={p.id} style={{ marginBottom: 32, breakInside: 'avoid' }}>
            <h1 className="display" style={{ marginBottom: 8, borderBottom: '1px solid var(--hairline)', paddingBottom: 4 }}>
              {p.icon ? `${p.icon} ` : ''}{p.title || 'Sans titre'}
            </h1>
            {p.kind === 'database' ? (
              <table style={{ borderCollapse: 'collapse', margin: '6px 0', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid var(--hairline)', padding: '4px 8px', fontSize: 12, textAlign: 'left', color: 'var(--ink-subtle)' }}>Titre</th>
                    {(p.schema?.properties ?? []).map((prop) => (
                      <th key={prop.id} style={{ border: '1px solid var(--hairline)', padding: '4px 8px', fontSize: 12, textAlign: 'left', color: 'var(--ink-subtle)' }}>{prop.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {childrenOf(pages, p.id).map((row) => (
                    <tr key={row.id}>
                      <td style={{ border: '1px solid var(--hairline)', padding: '4px 8px', fontSize: 13 }}>{row.title || '(sans titre)'}</td>
                      {(p.schema?.properties ?? []).map((prop) => (
                        <td key={prop.id} style={{ border: '1px solid var(--hairline)', padding: '4px 8px', fontSize: 13 }}>
                          {formatPropValue(propValue(row, prop.id), prop)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : p.blocks.map((b) => <PrintBlock key={b.id} block={b} />)}
          </section>
        ))}
        {!ordered.length && <span className="caption">Aucune page à exporter.</span>}
      </div>
    </div>
  )
}
