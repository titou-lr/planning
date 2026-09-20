import { Fragment } from 'react'
import { splitByLinks } from '../../core/links'
import { parseInline } from '../../core/blocks'
import { useStore } from '../../store/useStore'
import { buildTitleIndex, titleKey } from '../../core/links'

/**
 * Rendu inline d'un texte de bloc : markdown léger (**gras**, *italique*,
 * `code`) + liens de page [[Titre]] cliquables. Un lien vers une page
 * inexistante la crée au clic.
 */
export default function RenderInline({ text }: { text: string }) {
  const pages = useStore((s) => s.data.pages)

  function openOrCreate(title: string) {
    const idx = buildTitleIndex(pages)
    const target = idx.get(titleKey(title))
    const store = useStore.getState()
    if (target) store.setCurrentPage(target.id)
    else store.setCurrentPage(store.createPage(null, 'page', title))
  }

  const linkSegs = splitByLinks(text)
  return (
    <>
      {linkSegs.map((seg, i) => {
        if (seg.kind === 'link') {
          const exists = buildTitleIndex(pages).has(titleKey(seg.title))
          return (
            <span
              key={i}
              className="page-link"
              style={exists ? undefined : { opacity: 0.6, borderBottom: '1px dashed var(--ink-tertiary)' }}
              onClick={(e) => { e.stopPropagation(); openOrCreate(seg.title) }}
            >
              {seg.title}
            </span>
          )
        }
        return (
          <Fragment key={i}>
            {parseInline(seg.value).map((s, j) => {
              if (s.kind === 'bold') return <strong key={j}>{s.value}</strong>
              if (s.kind === 'italic') return <em key={j}>{s.value}</em>
              if (s.kind === 'code') return <code key={j} className="inline-code">{s.value}</code>
              return <Fragment key={j}>{s.value}</Fragment>
            })}
          </Fragment>
        )
      })}
    </>
  )
}
