import { useState, type DragEvent } from 'react'
import { useStore } from '../store/useStore'
import { childrenOf } from '../core/tree'
import type { Page } from '../core/types'
import { IconChevron, IconFile, IconDatabase, IconTemplate, IconPlus } from './icons'

/**
 * Arborescence de pages (profondeur illimitée) avec pliage/dépliage et
 * déplacement par glisser-déposer : déposer SUR un item = enfant,
 * déposer sur la moitié basse = frère suivant.
 */

function pageIcon(page: Page) {
  if (page.icon) return <span style={{ fontSize: 13, flex: 'none' }}>{page.icon}</span>
  if (page.kind === 'database') return <IconDatabase width={13} height={13} />
  if (page.kind === 'template') return <IconTemplate width={13} height={13} />
  return <IconFile width={13} height={13} />
}

function TreeNode({ page, depth }: { page: Page; depth: number }) {
  const pages = useStore((s) => s.data.pages)
  const currentPageId = useStore((s) => s.currentPageId)
  const expanded = useStore((s) => s.expanded)
  const { setCurrentPage, toggleExpanded, movePage } = useStore.getState()
  const [dragOver, setDragOver] = useState<'into' | 'below' | null>(null)

  const kids = childrenOf(pages, page.id)
  const isOpen = expanded[page.id] ?? false

  function onDrop(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    const draggedId = e.dataTransfer.getData('text/page-id')
    setDragOver(null)
    if (!draggedId || draggedId === page.id) return
    if (dragOver === 'into') {
      movePage(draggedId, page.id, childrenOf(pages, page.id).length)
    } else {
      const siblings = childrenOf(pages, page.parentId)
      const idx = siblings.findIndex((s) => s.id === page.id)
      movePage(draggedId, page.parentId, idx + 1)
    }
  }

  return (
    <>
      <div
        className={`tree-item${currentPageId === page.id ? ' on' : ''}${dragOver === 'into' ? ' drag-over' : ''}${dragOver === 'below' ? ' drag-over-below' : ''}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        draggable
        onClick={() => setCurrentPage(page.id)}
        onDragStart={(e) => e.dataTransfer.setData('text/page-id', page.id)}
        onDragOver={(e) => {
          e.preventDefault()
          const rect = e.currentTarget.getBoundingClientRect()
          setDragOver(e.clientY > rect.top + rect.height * 0.6 ? 'below' : 'into')
        }}
        onDragLeave={() => setDragOver(null)}
        onDrop={onDrop}
      >
        <span
          className={`chev${isOpen ? ' open' : ''}`}
          style={{ display: 'inline-flex', width: 12, visibility: kids.length ? 'visible' : 'hidden' }}
          onClick={(e) => { e.stopPropagation(); toggleExpanded(page.id) }}
        >
          <IconChevron />
        </span>
        {pageIcon(page)}
        <span className="tree-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
          {page.title || 'Sans titre'}
        </span>
      </div>
      {isOpen && kids.map((k) => <TreeNode key={k.id} page={k} depth={depth + 1} />)}
    </>
  )
}

export default function SidebarTree() {
  const pages = useStore((s) => s.data.pages)
  const { movePage, createPage, setCurrentPage } = useStore.getState()
  const roots = childrenOf(pages, null).filter((p) => p.kind !== 'template')
  const templates = pages.filter((p) => p.kind === 'template')

  return (
    <div
      className="col scroll"
      style={{ flex: 1, paddingBottom: 8 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        // Dépôt sur le fond = déplacer à la racine, en dernier
        const draggedId = e.dataTransfer.getData('text/page-id')
        if (draggedId) movePage(draggedId, null, roots.length)
      }}
    >
      <div className="cmd-section tree-label" style={{ padding: '10px 16px 4px' }}>Pages</div>
      {roots.map((p) => <TreeNode key={p.id} page={p} depth={0} />)}
      <div
        className="tree-item"
        style={{ color: 'var(--ink-tertiary)' }}
        onClick={() => setCurrentPage(createPage(null))}
      >
        <IconPlus width={13} height={13} />
        <span className="tree-label">Nouvelle page</span>
      </div>
      {templates.length > 0 && (
        <>
          <div className="cmd-section tree-label" style={{ padding: '12px 16px 4px' }}>Templates</div>
          {templates.map((p) => <TreeNode key={p.id} page={p} depth={0} />)}
        </>
      )}
    </div>
  )
}
