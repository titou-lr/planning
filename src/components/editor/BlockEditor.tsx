import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import type { Block, Page } from '../../core/types'
import {
  newBlock, detectShortcut, continuationType,
  insertBlockAfter, updateBlock, removeBlock, moveBlock,
} from '../../core/blocks'
import { uid } from '../../core/id'
import { useStore } from '../../store/useStore'
import { searchPages } from '../../core/search'
import RenderInline from './RenderInline'
import { IconGrip, IconPlus, IconTrash } from '../icons'

/**
 * Éditeur de texte riche par blocs :
 * - raccourcis markdown en début de ligne (#, -, 1., >, [], ```, ---)
 * - Entrée = nouveau bloc (les listes se poursuivent), Backspace sur bloc
 *   vide = fusion/suppression
 * - réordonnancement par glisser-déposer (poignée)
 * - blocs non focalisés rendus avec mise en forme + liens [[Page]]
 *   cliquables ; le bloc en cours d'édition montre le texte brut
 * - autocomplétion [[ pour lier une page
 * - collage d'image → bloc image (data URL, 100% local)
 */

interface Props {
  /** Page hôte, ou hôte générique (tâche…) : id + blocs suffisent. */
  page: Pick<Page, 'id' | 'blocks'> & { title?: string }
  /** Si fourni, les blocs sont écrits via ce callback (hôte non-page) au
   *  lieu du store de pages, et l'historique de versions est désactivé. */
  onChangeBlocks?: (next: Block[], coalesceKey?: string) => void
}

const PLACEHOLDERS: Partial<Record<Block['type'], string>> = {
  paragraph: 'Écrire, ou « / markdown » : #, -, 1., >, [], ```…',
  heading1: 'Titre 1',
  heading2: 'Titre 2',
  heading3: 'Titre 3',
  todo: 'À faire',
  quote: 'Citation',
  code: 'Code',
}

function blockClass(b: Block): string {
  switch (b.type) {
    case 'heading1': return 'block-h1'
    case 'heading2': return 'block-h2'
    case 'heading3': return 'block-h3'
    case 'quote': return 'block-quote'
    case 'code': return 'block-code'
    default: return ''
  }
}

function caretOffset(el: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return 0
  const range = sel.getRangeAt(0)
  const pre = range.cloneRange()
  pre.selectNodeContents(el)
  pre.setEnd(range.startContainer, range.startOffset)
  return pre.toString().length
}

function placeCaret(el: HTMLElement, offset: number) {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  let remaining = offset
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const len = node.textContent?.length ?? 0
    if (remaining <= len) {
      range.setStart(node, remaining)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      return
    }
    remaining -= len
    node = walker.nextNode()
  }
  range.selectNodeContents(el)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

export default function BlockEditor({ page, onChangeBlocks }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [linkMenu, setLinkMenu] = useState<{ blockId: string; query: string } | null>(null)
  const [linkSel, setLinkSel] = useState(0)
  const pendingCaret = useRef<{ id: string; offset: number } | null>(null)
  const editableRefs = useRef(new Map<string, HTMLElement>())
  const pages = useStore((s) => s.data.pages)
  const blocks = page.blocks.length ? page.blocks : [newBlock()]

  const setBlocks = (next: Block[], coalesceKey?: string) =>
    onChangeBlocks
      ? onChangeBlocks(next, coalesceKey)
      : useStore.getState().setBlocks(page.id, next, coalesceKey)

  // Snapshot d'historique de versions : 5s d'inactivité après une frappe
  // (pages uniquement — les hôtes génériques n'ont pas d'historique)
  useEffect(() => {
    if (onChangeBlocks) return
    const t = setTimeout(() => useStore.getState().snapshotVersion(page.id), 5000)
    return () => clearTimeout(t)
  }, [page.blocks, page.title, page.id, onChangeBlocks])

  // Positionne le caret demandé après re-render (split/merge/navigation)
  useEffect(() => {
    const req = pendingCaret.current
    if (!req) return
    const el = editableRefs.current.get(req.id)
    if (el) {
      el.focus()
      placeCaret(el, req.offset)
    }
    pendingCaret.current = null
  })

  const linkCandidates = useMemo(() => {
    if (!linkMenu) return []
    const q = linkMenu.query.trim()
    const base = q
      ? searchPages(pages, q, 6).map((r) => pages.find((p) => p.id === r.pageId)!).filter(Boolean)
      : [...pages].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6)
    return base.filter((p) => p.id !== page.id && p.kind !== 'template')
  }, [linkMenu, pages, page.id])

  useEffect(() => setLinkSel(0), [linkMenu?.query])

  function focusBlock(id: string, offset: number) {
    pendingCaret.current = { id, offset }
    setEditingId(id)
  }

  function insertLink(blockId: string, title: string) {
    const el = editableRefs.current.get(blockId)
    const block = blocks.find((b) => b.id === blockId)
    if (!el || !block) return
    const text = el.textContent ?? ''
    const idx = text.lastIndexOf('[[')
    if (idx < 0) return
    const next = `${text.slice(0, idx)}[[${title}]] `
    setBlocks(updateBlock(blocks, blockId, { text: next }), `blocks:${page.id}`)
    setLinkMenu(null)
    pendingCaret.current = { id: blockId, offset: next.length }
  }

  function onInput(b: Block, el: HTMLElement) {
    const text = el.textContent ?? ''

    // Autocomplétion [[ : texte avant caret finissant par [[query
    const upToCaret = text.slice(0, caretOffset(el))
    const m = upToCaret.match(/\[\[([^\[\]]*)$/)
    setLinkMenu(m ? { blockId: b.id, query: m[1] } : null)

    // Raccourcis markdown (hors bloc code)
    if (b.type !== 'code') {
      const shortcut = detectShortcut(text)
      if (shortcut && shortcut.type !== b.type) {
        const offset = shortcut.rest.length
        setBlocks(updateBlock(blocks, b.id, { type: shortcut.type, text: shortcut.rest }))
        if (shortcut.type === 'divider') {
          // un divider n'est pas éditable : on enchaîne sur un nouveau bloc
          const nb = newBlock()
          setBlocks(insertBlockAfter(updateBlock(blocks, b.id, { type: 'divider', text: '' }), b.id, nb))
          focusBlock(nb.id, 0)
        } else {
          focusBlock(b.id, offset)
        }
        return
      }
    }
    setBlocks(updateBlock(blocks, b.id, { text }), `blocks:${page.id}`)
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>, b: Block, index: number) {
    const el = e.currentTarget
    const text = el.textContent ?? ''

    // Navigation du menu de lien
    if (linkMenu && linkCandidates.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setLinkSel((s) => Math.min(s + 1, linkCandidates.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setLinkSel((s) => Math.max(s - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertLink(b.id, linkCandidates[linkSel].title); return }
      if (e.key === 'Escape') { setLinkMenu(null); return }
    }

    if (e.key === 'Enter') {
      if (b.type === 'code') {
        if (!(e.ctrlKey || e.metaKey)) return // Entrée = nouvelle ligne dans le code
        // Ctrl+Entrée : sortir du bloc code
      }
      e.preventDefault()
      const offset = caretOffset(el)
      // Entrée sur une liste vide → redevient paragraphe
      if (!text && ['bulleted', 'numbered', 'todo'].includes(b.type)) {
        setBlocks(updateBlock(blocks, b.id, { type: 'paragraph' }))
        focusBlock(b.id, 0)
        return
      }
      const before = text.slice(0, offset)
      const after = text.slice(offset)
      const nb = newBlock(b.type === 'code' ? 'paragraph' : continuationType(b.type), after)
      if (b.type !== 'code') nb.indent = b.indent
      let next = updateBlock(blocks, b.id, { text: b.type === 'code' ? text : before })
      next = insertBlockAfter(next, b.id, nb)
      setBlocks(next)
      focusBlock(nb.id, 0)
      return
    }

    if (e.key === 'Backspace' && caretOffset(el) === 0) {
      // Début de bloc : dé-typer d'abord, sinon fusionner avec le précédent
      if (b.type !== 'paragraph') {
        e.preventDefault()
        setBlocks(updateBlock(blocks, b.id, { type: 'paragraph', indent: 0 }))
        focusBlock(b.id, 0)
        return
      }
      const prev = blocks[index - 1]
      if (!prev) return
      e.preventDefault()
      if (prev.type === 'divider' || prev.type === 'image' || prev.type === 'table') {
        setBlocks(removeBlock(blocks, prev.id))
        focusBlock(b.id, 0)
        return
      }
      const merged = updateBlock(removeBlock(blocks, b.id), prev.id, { text: prev.text + text })
      setBlocks(merged)
      focusBlock(prev.id, prev.text.length)
      return
    }

    if (e.key === 'Tab' && ['bulleted', 'numbered', 'todo'].includes(b.type)) {
      e.preventDefault()
      const delta = e.shiftKey ? -1 : 1
      const indent = Math.max(0, Math.min(6, (b.indent ?? 0) + delta))
      setBlocks(updateBlock(blocks, b.id, { indent }))
      focusBlock(b.id, caretOffset(el))
      return
    }

    if (e.key === 'ArrowUp' && !linkMenu) {
      const prev = blocks[index - 1]
      if (prev && caretOffset(el) === 0 && !['divider', 'image', 'table'].includes(prev.type)) {
        e.preventDefault()
        focusBlock(prev.id, prev.text.length)
      }
      return
    }
    if (e.key === 'ArrowDown' && !linkMenu) {
      const nextB = blocks[index + 1]
      if (nextB && caretOffset(el) >= text.length && !['divider', 'image', 'table'].includes(nextB.type)) {
        e.preventDefault()
        focusBlock(nextB.id, 0)
      }
    }
  }

  function onPaste(e: React.ClipboardEvent, b: Block) {
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/'))
    if (!file) return
    e.preventDefault()
    const reader = new FileReader()
    reader.onload = () => {
      const img: Block = { id: uid(), type: 'image', text: file.name, src: String(reader.result) }
      setBlocks(insertBlockAfter(blocks, b.id, img))
    }
    reader.readAsDataURL(file)
  }

  function onDropBlock(e: DragEvent, targetId: string) {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('text/block-id')
    setDragOverId(null)
    if (!draggedId || draggedId === targetId) return
    const targetIdx = blocks.findIndex((x) => x.id === targetId)
    const fromIdx = blocks.findIndex((x) => x.id === draggedId)
    const to = fromIdx < targetIdx ? targetIdx : targetIdx + 1
    setBlocks(moveBlock(blocks, draggedId, to - (fromIdx < to ? 1 : 0)))
  }

  function updateTableCell(b: Block, r: number, c: number, value: string) {
    const rows = (b.rows ?? []).map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row))
    setBlocks(updateBlock(blocks, b.id, { rows }), `table:${b.id}`)
  }

  function renderStatic(b: Block, index: number) {
    // Blocs sans texte éditable inline
    if (b.type === 'divider') return <hr className="block-divider" />
    if (b.type === 'image')
      return (
        <div className="col gap4" style={{ padding: '4px 0' }}>
          <img src={b.src} alt={b.text} style={{ maxWidth: '100%', borderRadius: 'var(--r-md)', border: '1px solid var(--hairline)' }} />
          {b.text && <span className="caption">{b.text}</span>}
        </div>
      )
    if (b.type === 'table') {
      const rows = b.rows ?? [['']]
      const cols = rows[0]?.length ?? 1
      return (
        <div className="col gap4" style={{ padding: '4px 0', overflowX: 'auto' }}>
          <table className="tbl" style={{ border: '1px solid var(--hairline)', borderRadius: 'var(--r-md)' }}>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} style={{ height: 34, border: '1px solid var(--hairline-soft)' }}>
                      <span
                        contentEditable
                        suppressContentEditableWarning
                        style={{ outline: 'none', display: 'block', minWidth: 60 }}
                        onBlur={(e) => updateTableCell(b, r, c, e.currentTarget.textContent ?? '')}
                      >
                        {cell}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row gap6">
            <button className="btn btn-sm btn-ghost" onClick={() => setBlocks(updateBlock(blocks, b.id, { rows: [...rows, Array(cols).fill('')] }))}>
              <IconPlus width={12} height={12} /> Ligne
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setBlocks(updateBlock(blocks, b.id, { rows: rows.map((r) => [...r, '']) }))}>
              <IconPlus width={12} height={12} /> Colonne
            </button>
          </div>
        </div>
      )
    }
    // Bloc texte non focalisé : rendu formaté cliquable
    return (
      <div
        className={`block-content ${blockClass(b)}`}
        data-placeholder={PLACEHOLDERS[b.type] ?? ''}
        style={{ minHeight: 24, cursor: 'text' }}
        onClick={() => focusBlock(b.id, b.text.length)}
      >
        {b.type === 'numbered' && <span style={{ color: 'var(--ink-subtle)', marginRight: 6 }}>{numberedIndex(blocks, index)}.</span>}
        {b.type === 'bulleted' && <span style={{ color: 'var(--ink-subtle)', marginRight: 8 }}>•</span>}
        {b.type === 'code' ? <span style={{ whiteSpace: 'pre-wrap' }}>{b.text}</span> : <RenderInline text={b.text} />}
      </div>
    )
  }

  return (
    <div className="col" style={{ maxWidth: 720, width: '100%' }}>
      {blocks.map((b, index) => {
        const isEditing = editingId === b.id
        const editable = !['divider', 'image', 'table'].includes(b.type)
        return (
          <div
            key={b.id}
            className={`block-row${b.type === 'todo' && b.checked ? ' block-done' : ''}${dragOverId === b.id ? ' drag-over-below' : ''}`}
            style={{ marginLeft: (b.indent ?? 0) * 22 }}
            onDragOver={(e) => { e.preventDefault(); setDragOverId(b.id) }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(e) => onDropBlock(e, b.id)}
          >
            <span
              className="block-handle"
              draggable
              title="Glisser pour réordonner"
              onDragStart={(e) => e.dataTransfer.setData('text/block-id', b.id)}
            >
              <IconGrip />
            </span>
            {b.type === 'todo' && (
              <input
                type="checkbox"
                className="todo-check"
                checked={b.checked ?? false}
                onChange={(e) => setBlocks(updateBlock(blocks, b.id, { checked: e.target.checked }))}
              />
            )}
            {b.type === 'bulleted' && isEditing && <span style={{ color: 'var(--ink-subtle)', margin: '0 4px' }}>•</span>}
            {b.type === 'numbered' && isEditing && <span style={{ color: 'var(--ink-subtle)', margin: '0 2px' }}>{numberedIndex(blocks, index)}.</span>}

            {editable && isEditing ? (
              <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                <div
                  ref={(el) => { if (el) editableRefs.current.set(b.id, el); else editableRefs.current.delete(b.id) }}
                  className={`block-content ${blockClass(b)}`}
                  contentEditable="plaintext-only"
                  suppressContentEditableWarning
                  data-placeholder={PLACEHOLDERS[b.type] ?? ''}
                  onInput={(e) => onInput(b, e.currentTarget)}
                  onKeyDown={(e) => onKeyDown(e, b, index)}
                  onPaste={(e) => onPaste(e, b)}
                  onBlur={() => {
                    setTimeout(() => setLinkMenu((lm) => (lm?.blockId === b.id ? null : lm)), 150)
                    setEditingId((cur) => (cur === b.id ? null : cur))
                    if (!onChangeBlocks) useStore.getState().snapshotVersion(page.id)
                  }}
                >
                  {b.text}
                </div>
                {linkMenu?.blockId === b.id && linkCandidates.length > 0 && (
                  <div
                    className="panel-flush col"
                    style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, width: 280, boxShadow: 'var(--shadow-pop)', padding: 4, background: 'var(--surface-2)' }}
                  >
                    <div className="cmd-section">Lier une page</div>
                    {linkCandidates.map((p, i) => (
                      <div
                        key={p.id}
                        className={`cmd-row${i === linkSel ? ' on' : ''}`}
                        style={{ height: 32 }}
                        onMouseDown={(e) => { e.preventDefault(); insertLink(b.id, p.title) }}
                        onMouseEnter={() => setLinkSel(i)}
                      >
                        {p.title || 'Sans titre'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ flex: 1, minWidth: 0 }}>{renderStatic(b, index)}</div>
            )}

            <span
              className="block-handle"
              title="Supprimer le bloc"
              onClick={() => setBlocks(blocks.length > 1 ? removeBlock(blocks, b.id) : [newBlock()])}
            >
              <IconTrash width={11} height={11} />
            </span>
          </div>
        )
      })}
      {/* Zone de clic sous le dernier bloc : ajoute un paragraphe */}
      <div
        style={{ minHeight: 120, cursor: 'text' }}
        onClick={() => {
          const last = blocks[blocks.length - 1]
          if (last && last.type === 'paragraph' && !last.text) {
            focusBlock(last.id, 0)
          } else {
            const nb = newBlock()
            setBlocks([...blocks, nb])
            focusBlock(nb.id, 0)
          }
        }}
      />
    </div>
  )
}

function numberedIndex(blocks: Block[], index: number): number {
  let n = 1
  for (let i = index - 1; i >= 0; i--) {
    if (blocks[i].type === 'numbered' && (blocks[i].indent ?? 0) === (blocks[index].indent ?? 0)) n++
    else if (blocks[i].type !== 'numbered') break
  }
  return n
}
