import type { Page } from '../core/types'
import { useStore } from '../store/useStore'
import { blocksToMarkdown } from '../core/markdown'
import { IconX } from './icons'

/** Panneau latéral (DESIGN.md §6.10) : historique de versions d'une page. */
export default function HistoryPanel({ page, onClose }: { page: Page; onClose: () => void }) {
  const versions = useStore((s) => s.data.versions[page.id] ?? [])
  const list = [...versions].reverse()

  return (
    <aside className="detail-panel no-print">
      <div className="subhead-bar spread">
        <span className="subhead">Historique — {versions.length} version{versions.length > 1 ? 's' : ''}</span>
        <button className="btn btn-icon btn-sm btn-ghost" onClick={onClose}><IconX width={14} height={14} /></button>
      </div>
      <div className="scroll col" style={{ flex: 1, padding: 8, gap: 8 }}>
        {list.length === 0 && (
          <span className="caption" style={{ padding: 8 }}>
            Aucune version enregistrée pour l’instant. Une version est capturée automatiquement pendant l’édition.
          </span>
        )}
        {list.map((v) => (
          <div key={v.id} className="panel-flush col gap6" style={{ padding: 10 }}>
            <div className="spread">
              <span className="caption mono">{new Date(v.at).toLocaleString('fr-FR')}</span>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => useStore.getState().restoreVersion(page.id, v.id)}
              >
                Restaurer
              </button>
            </div>
            <span className="subhead">{v.title || 'Sans titre'}</span>
            <pre
              className="caption"
              style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'hidden', fontFamily: 'var(--font-ui)' }}
            >
              {blocksToMarkdown(v.blocks).slice(0, 400) || '(page vide)'}
            </pre>
          </div>
        ))}
      </div>
    </aside>
  )
}
