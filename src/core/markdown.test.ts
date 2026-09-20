import { describe, it, expect } from 'vitest'
import { blocksToMarkdown, markdownToBlocks, markdownToPageContent } from './markdown'
import type { Block } from './types'

describe('markdown', () => {
  it('round-trip des types de blocs principaux', () => {
    const md = [
      '# Titre 1',
      '',
      'Un paragraphe.',
      '',
      '- puce un',
      '- puce deux',
      '',
      '1. numéro',
      '',
      '- [x] fait',
      '- [ ] à faire',
      '',
      '> citation',
      '',
      '```js',
      'const x = 1',
      '```',
      '',
      '---',
    ].join('\n')
    const blocks = markdownToBlocks(md)
    expect(blocks.map((b) => b.type)).toEqual([
      'heading1', 'paragraph', 'bulleted', 'bulleted', 'numbered',
      'todo', 'todo', 'quote', 'code', 'divider',
    ])
    expect(blocks[5].checked).toBe(true)
    expect(blocks[6].checked).toBe(false)
    expect(blocks[8].language).toBe('js')
    expect(blocks[8].text).toBe('const x = 1')

    // le re-export reproduit les mêmes blocs au re-import
    const again = markdownToBlocks(blocksToMarkdown(blocks))
    expect(again.map((b) => ({ type: b.type, text: b.text, checked: b.checked }))).toEqual(
      blocks.map((b) => ({ type: b.type, text: b.text, checked: b.checked }))
    )
  })

  it('parse les tables', () => {
    const md = '| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |'
    const [tbl] = markdownToBlocks(md)
    expect(tbl.type).toBe('table')
    expect(tbl.rows).toEqual([['A', 'B'], ['1', '2'], ['3', '4']])
    expect(blocksToMarkdown([tbl])).toContain('| 1 | 2 |')
  })

  it('parse les images', () => {
    const [img] = markdownToBlocks('![légende](data:image/png;base64,xyz)')
    expect(img.type).toBe('image')
    expect(img.src).toBe('data:image/png;base64,xyz')
    expect(img.text).toBe('légende')
  })

  it('préserve l’indentation des listes', () => {
    const blocks = markdownToBlocks('- parent\n  - enfant')
    expect(blocks[0].indent ?? 0).toBe(0)
    expect(blocks[1].indent).toBe(1)
  })

  it('extrait le H1 initial comme titre de page', () => {
    const { title, blocks } = markdownToPageContent('# Ma page\n\ncontenu', 'fallback')
    expect(title).toBe('Ma page')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].text).toBe('contenu')
  })

  it('titre de secours si pas de H1', () => {
    const { title } = markdownToPageContent('juste du texte', 'Sans titre')
    expect(title).toBe('Sans titre')
  })

  it('exporte une table todo cochée', () => {
    const b: Block = { id: 'x', type: 'todo', text: 'ok', checked: true }
    expect(blocksToMarkdown([b])).toBe('- [x] ok')
  })
})
