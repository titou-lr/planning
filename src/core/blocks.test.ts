import { describe, it, expect } from 'vitest'
import { detectShortcut, continuationType, insertBlockAfter, moveBlock, parseInline, newBlock } from './blocks'

describe('blocks', () => {
  it('détecte les raccourcis markdown', () => {
    expect(detectShortcut('# Titre')).toEqual({ type: 'heading1', rest: 'Titre' })
    expect(detectShortcut('## Sous')).toEqual({ type: 'heading2', rest: 'Sous' })
    expect(detectShortcut('- item')).toEqual({ type: 'bulleted', rest: 'item' })
    expect(detectShortcut('1. un')).toEqual({ type: 'numbered', rest: 'un' })
    expect(detectShortcut('[] tâche')).toEqual({ type: 'todo', rest: 'tâche' })
    expect(detectShortcut('> mot')).toEqual({ type: 'quote', rest: 'mot' })
    expect(detectShortcut('```')).toEqual({ type: 'code', rest: '' })
    expect(detectShortcut('---')).toEqual({ type: 'divider', rest: '' })
    expect(detectShortcut('normal')).toBeNull()
    expect(detectShortcut('#pas-un-titre')).toBeNull()
  })

  it('les listes se poursuivent à l’Entrée', () => {
    expect(continuationType('bulleted')).toBe('bulleted')
    expect(continuationType('todo')).toBe('todo')
    expect(continuationType('heading1')).toBe('paragraph')
  })

  it('insère après un bloc', () => {
    const a = newBlock('paragraph', 'a')
    const b = newBlock('paragraph', 'b')
    const n = newBlock('paragraph', 'n')
    expect(insertBlockAfter([a, b], a.id, n).map((x) => x.text)).toEqual(['a', 'n', 'b'])
  })

  it('déplace un bloc (drag-and-drop)', () => {
    const [a, b, c] = [newBlock('paragraph', 'a'), newBlock('paragraph', 'b'), newBlock('paragraph', 'c')]
    expect(moveBlock([a, b, c], c.id, 0).map((x) => x.text)).toEqual(['c', 'a', 'b'])
    expect(moveBlock([a, b, c], a.id, 2).map((x) => x.text)).toEqual(['b', 'c', 'a'])
  })

  it('parse la mise en forme inline', () => {
    expect(parseInline('du **gras** et du `code`')).toEqual([
      { kind: 'text', value: 'du ' },
      { kind: 'bold', value: 'gras' },
      { kind: 'text', value: ' et du ' },
      { kind: 'code', value: 'code' },
    ])
    expect(parseInline('*italique* seul')).toEqual([
      { kind: 'italic', value: 'italique' },
      { kind: 'text', value: ' seul' },
    ])
  })
})
