import type { Block, Page } from './types'
import { uid } from './id'

/**
 * Import/export Markdown pur (aucune dépendance).
 * Couvre : titres 1-3, listes à puces/numérotées/todo (avec indentation),
 * citations, blocs de code, séparateurs, images, tables.
 */

export function blocksToMarkdown(blocks: Block[]): string {
  const lines: string[] = []
  let prevType = ''
  for (const b of blocks) {
    const pad = '  '.repeat(b.indent ?? 0)
    const isList = ['bulleted', 'numbered', 'todo'].includes(b.type)
    const prevIsList = ['bulleted', 'numbered', 'todo'].includes(prevType)
    if (lines.length && !(isList && prevIsList)) lines.push('')
    switch (b.type) {
      case 'heading1': lines.push(`# ${b.text}`); break
      case 'heading2': lines.push(`## ${b.text}`); break
      case 'heading3': lines.push(`### ${b.text}`); break
      case 'bulleted': lines.push(`${pad}- ${b.text}`); break
      case 'numbered': lines.push(`${pad}1. ${b.text}`); break
      case 'todo': lines.push(`${pad}- [${b.checked ? 'x' : ' '}] ${b.text}`); break
      case 'quote': lines.push(`> ${b.text}`); break
      case 'code':
        lines.push('```' + (b.language ?? ''))
        lines.push(b.text)
        lines.push('```')
        break
      case 'divider': lines.push('---'); break
      case 'image': lines.push(`![${b.text}](${b.src ?? ''})`); break
      case 'table': {
        const rows = b.rows ?? [[]]
        const header = rows[0] ?? []
        lines.push(`| ${header.join(' | ')} |`)
        lines.push(`| ${header.map(() => '---').join(' | ')} |`)
        for (const row of rows.slice(1)) lines.push(`| ${row.join(' | ')} |`)
        break
      }
      default: lines.push(b.text)
    }
    prevType = b.type
  }
  return lines.join('\n')
}

export function pageToMarkdown(page: Page): string {
  return `# ${page.title}\n\n${blocksToMarkdown(page.blocks)}\n`
}

function mkBlock(partial: Partial<Block> & { type: Block['type'] }): Block {
  return { id: uid(), text: '', ...partial }
}

export function markdownToBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) { i++; continue }

    // Bloc de code
    const fence = trimmed.match(/^```(\w*)$/)
    if (fence) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      i++ // saute la clôture
      blocks.push(mkBlock({ type: 'code', text: buf.join('\n'), language: fence[1] || undefined }))
      continue
    }

    // Table (au moins une ligne pipe + séparateur)
    if (trimmed.startsWith('|') && lines[i + 1]?.trim().match(/^\|[\s\-|:]+\|$/)) {
      const rows: string[][] = []
      const parseRow = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      rows.push(parseRow(lines[i]))
      i += 2
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseRow(lines[i]))
        i++
      }
      blocks.push(mkBlock({ type: 'table', rows }))
      continue
    }

    const indentMatch = line.match(/^(\s*)/)
    const indent = Math.floor((indentMatch?.[1].length ?? 0) / 2)

    let m: RegExpMatchArray | null
    if ((m = trimmed.match(/^#{1}\s+(.*)$/))) blocks.push(mkBlock({ type: 'heading1', text: m[1] }))
    else if ((m = trimmed.match(/^#{2}\s+(.*)$/))) blocks.push(mkBlock({ type: 'heading2', text: m[1] }))
    else if ((m = trimmed.match(/^#{3,}\s+(.*)$/))) blocks.push(mkBlock({ type: 'heading3', text: m[1] }))
    else if ((m = trimmed.match(/^[-*]\s+\[( |x|X)\]\s+(.*)$/)))
      blocks.push(mkBlock({ type: 'todo', text: m[2], checked: m[1].toLowerCase() === 'x', indent }))
    else if ((m = trimmed.match(/^[-*]\s+(.*)$/))) blocks.push(mkBlock({ type: 'bulleted', text: m[1], indent }))
    else if ((m = trimmed.match(/^\d+[.)]\s+(.*)$/))) blocks.push(mkBlock({ type: 'numbered', text: m[1], indent }))
    else if ((m = trimmed.match(/^>\s?(.*)$/))) blocks.push(mkBlock({ type: 'quote', text: m[1] }))
    else if (/^(---|\*\*\*|___)$/.test(trimmed)) blocks.push(mkBlock({ type: 'divider' }))
    else if ((m = trimmed.match(/^!\[([^\]]*)\]\(([^)]*)\)$/)))
      blocks.push(mkBlock({ type: 'image', text: m[1], src: m[2] }))
    else blocks.push(mkBlock({ type: 'paragraph', text: trimmed }))
    i++
  }
  return blocks
}

/**
 * Import d'un fichier .md : le premier H1 devient le titre de page,
 * le reste devient les blocs.
 */
export function markdownToPageContent(md: string, fallbackTitle: string): { title: string; blocks: Block[] } {
  const blocks = markdownToBlocks(md)
  if (blocks.length && blocks[0].type === 'heading1') {
    return { title: blocks[0].text || fallbackTitle, blocks: blocks.slice(1) }
  }
  return { title: fallbackTitle, blocks }
}
