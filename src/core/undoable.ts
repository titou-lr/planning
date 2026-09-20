/**
 * Gestionnaire d'undo/redo générique et pur : piles de snapshots avec
 * coalescence par clé (les frappes successives dans un même champ ne
 * créent qu'une entrée) et plafond de mémoire.
 */

export interface UndoStacks<T> {
  past: T[]
  future: T[]
  /** Clé de la dernière entrée coalescée + horodatage (ms). */
  lastKey: string | null
  lastAt: number
}

export const UNDO_CAP = 100
export const COALESCE_WINDOW_MS = 1000

export function emptyStacks<T>(): UndoStacks<T> {
  return { past: [], future: [], lastKey: null, lastAt: 0 }
}

/**
 * Empile `snapshot` (l'état AVANT mutation). Si la même clé de
 * coalescence revient dans la fenêtre, on ne ré-empile pas (le snapshot
 * d'origine reste le point de retour).
 */
export function pushSnapshot<T>(
  stacks: UndoStacks<T>,
  snapshot: T,
  key: string | null,
  now: number
): UndoStacks<T> {
  if (key && stacks.lastKey === key && now - stacks.lastAt < COALESCE_WINDOW_MS) {
    return { ...stacks, lastAt: now, future: [] }
  }
  const past = [...stacks.past, snapshot].slice(-UNDO_CAP)
  return { past, future: [], lastKey: key, lastAt: now }
}

export interface UndoResult<T> {
  stacks: UndoStacks<T>
  state: T
}

export function undo<T>(stacks: UndoStacks<T>, current: T): UndoResult<T> | null {
  if (!stacks.past.length) return null
  const prev = stacks.past[stacks.past.length - 1]
  return {
    stacks: {
      past: stacks.past.slice(0, -1),
      future: [...stacks.future, current],
      lastKey: null,
      lastAt: 0,
    },
    state: prev,
  }
}

export function redo<T>(stacks: UndoStacks<T>, current: T): UndoResult<T> | null {
  if (!stacks.future.length) return null
  const next = stacks.future[stacks.future.length - 1]
  return {
    stacks: {
      past: [...stacks.past, current].slice(-UNDO_CAP),
      future: stacks.future.slice(0, -1),
      lastKey: null,
      lastAt: 0,
    },
    state: next,
  }
}
