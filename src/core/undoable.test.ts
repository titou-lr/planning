import { describe, it, expect } from 'vitest'
import { emptyStacks, pushSnapshot, undo, redo, UNDO_CAP } from './undoable'

describe('undoable', () => {
  it('undo restaure le snapshot, redo le ré-applique', () => {
    let stacks = emptyStacks<number>()
    stacks = pushSnapshot(stacks, 1, null, 0) // état avant mutation → 2
    const u = undo(stacks, 2)
    expect(u?.state).toBe(1)
    const r = redo(u!.stacks, 1)
    expect(r?.state).toBe(2)
  })

  it('undo sur pile vide → null', () => {
    expect(undo(emptyStacks<number>(), 1)).toBeNull()
    expect(redo(emptyStacks<number>(), 1)).toBeNull()
  })

  it('coalesce les frappes rapprochées de même clé', () => {
    let stacks = emptyStacks<string>()
    stacks = pushSnapshot(stacks, 'v0', 'champ-x', 1000)
    stacks = pushSnapshot(stacks, 'v1', 'champ-x', 1500) // même clé, < 1s
    expect(stacks.past).toEqual(['v0']) // un seul point de retour
    stacks = pushSnapshot(stacks, 'v2', 'champ-x', 3000) // fenêtre expirée
    expect(stacks.past).toEqual(['v0', 'v2'])
  })

  it('clés différentes ne coalescent pas', () => {
    let stacks = emptyStacks<string>()
    stacks = pushSnapshot(stacks, 'a', 'k1', 1000)
    stacks = pushSnapshot(stacks, 'b', 'k2', 1100)
    expect(stacks.past).toEqual(['a', 'b'])
  })

  it('une nouvelle mutation vide la pile redo', () => {
    let stacks = emptyStacks<number>()
    stacks = pushSnapshot(stacks, 1, null, 0)
    const u = undo(stacks, 2)!
    const after = pushSnapshot(u.stacks, 1, null, 5000)
    expect(after.future).toEqual([])
  })

  it('plafonne la mémoire à UNDO_CAP', () => {
    let stacks = emptyStacks<number>()
    for (let i = 0; i < UNDO_CAP + 20; i++) stacks = pushSnapshot(stacks, i, null, i * 5000)
    expect(stacks.past).toHaveLength(UNDO_CAP)
    expect(stacks.past[0]).toBe(20)
  })
})
