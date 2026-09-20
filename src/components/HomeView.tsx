import { useStore } from '../store/useStore'
import { markdownToPageContent } from '../core/markdown'
import { pickFile } from '../store/exportImport'
import { uid } from '../core/id'
import { useToast } from './Toast'
import { IconPlus, IconDatabase, IconUpload, IconFile } from './icons'

/** Accueil : pages récentes + actions de départ. */
export default function HomeView() {
  const pages = useStore((s) => s.data.pages)
  const show = useToast((s) => s.show)
  const recent = [...pages]
    .filter((p) => p.kind !== 'template')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 12)

  async function importMarkdown() {
    const file = await pickFile('.md,.markdown,.txt')
    if (!file) return
    const { title, blocks } = markdownToPageContent(file.text, file.name.replace(/\.(md|markdown|txt)$/i, ''))
    const store = useStore.getState()
    store.insertPage({ id: uid(), title, parentId: null, kind: 'page', blocks })
    show(`« ${title} » importée depuis Markdown`)
  }

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div className="col gap16" style={{ maxWidth: 860, margin: '0 auto', padding: '48px 24px' }}>
        <div className="col gap4">
          <span className="headline">Bonjour</span>
          <span className="caption">Notes, bases de données et pages — 100&nbsp;% local, rien ne quitte cette machine.</span>
        </div>

        <div className="row gap8">
          <button className="btn btn-primary" onClick={() => useStore.getState().setCurrentPage(useStore.getState().createPage(null))}>
            <IconPlus width={14} height={14} /> Nouvelle page
          </button>
          <button className="btn btn-secondary" onClick={() => useStore.getState().setCurrentPage(useStore.getState().createDatabase(null))}>
            <IconDatabase width={14} height={14} /> Nouvelle base de données
          </button>
          <button className="btn btn-ghost" onClick={importMarkdown}>
            <IconUpload width={14} height={14} /> Importer un fichier Markdown
          </button>
        </div>

        {recent.length > 0 && (
          <div className="col gap8">
            <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>Modifiées récemment</span>
            <div className="panel col" style={{ overflow: 'hidden' }}>
              {recent.map((p) => (
                <div key={p.id} className="lrow" onClick={() => useStore.getState().setCurrentPage(p.id)}>
                  {p.icon ? <span style={{ fontSize: 14 }}>{p.icon}</span> : p.kind === 'database' ? <IconDatabase width={14} height={14} style={{ color: 'var(--ink-subtle)' }} /> : <IconFile width={14} height={14} style={{ color: 'var(--ink-subtle)' }} />}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title || 'Sans titre'}</span>
                  <span className="caption mono">{new Date(p.updatedAt).toLocaleDateString('fr-FR')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
