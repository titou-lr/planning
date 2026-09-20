import type { Page } from './types'

/**
 * Opérations pures sur l'arborescence de pages (profondeur illimitée).
 * Les pages sont stockées à plat ; la hiérarchie vient de parentId + order.
 */

export function childrenOf(pages: Page[], parentId: string | null): Page[] {
  return pages
    .filter((p) => p.parentId === parentId)
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
}

export function findPage(pages: Page[], id: string): Page | undefined {
  return pages.find((p) => p.id === id)
}

/** Tous les descendants (récursif), sans la page elle-même. */
export function descendantsOf(pages: Page[], id: string): Page[] {
  const out: Page[] = []
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop() as string
    for (const child of pages.filter((p) => p.parentId === cur)) {
      out.push(child)
      stack.push(child.id)
    }
  }
  return out
}

/** Chaîne d'ancêtres, de la racine vers le parent direct. */
export function ancestorsOf(pages: Page[], id: string): Page[] {
  const out: Page[] = []
  let cur = findPage(pages, id)
  const seen = new Set<string>([id])
  while (cur && cur.parentId) {
    if (seen.has(cur.parentId)) break // donnée corrompue (cycle) → dégradation, pas de crash
    seen.add(cur.parentId)
    const parent = findPage(pages, cur.parentId)
    if (!parent) break
    out.unshift(parent)
    cur = parent
  }
  return out
}

/** Vrai si `targetId` est `id` ou un de ses descendants (déplacement interdit). */
export function isSelfOrDescendant(pages: Page[], id: string, targetId: string): boolean {
  if (id === targetId) return true
  return descendantsOf(pages, id).some((p) => p.id === targetId)
}

/** Prochain ordre disponible sous un parent. */
export function nextOrder(pages: Page[], parentId: string | null): number {
  const siblings = childrenOf(pages, parentId)
  return siblings.length ? siblings[siblings.length - 1].order + 1 : 0
}

/**
 * Déplace une page (et implicitement ses enfants) sous newParentId, à la
 * position `index` parmi les frères. Refuse les cycles (retourne l'entrée
 * inchangée). Retourne un nouveau tableau, jamais de mutation.
 */
export function movePage(
  pages: Page[],
  id: string,
  newParentId: string | null,
  index: number
): Page[] {
  if (newParentId && isSelfOrDescendant(pages, id, newParentId)) return pages
  const page = findPage(pages, id)
  if (!page) return pages
  const siblings = childrenOf(pages, newParentId).filter((p) => p.id !== id)
  const clamped = Math.max(0, Math.min(index, siblings.length))
  siblings.splice(clamped, 0, { ...page, parentId: newParentId })
  const orderById = new Map(siblings.map((p, i) => [p.id, i]))
  return pages.map((p) => {
    if (p.id === id) return { ...p, parentId: newParentId, order: orderById.get(id) ?? 0 }
    const ord = orderById.get(p.id)
    return ord !== undefined ? { ...p, order: ord } : p
  })
}

/** Supprime une page et tout son sous-arbre. */
export function deleteSubtree(pages: Page[], id: string): Page[] {
  const doomed = new Set([id, ...descendantsOf(pages, id).map((p) => p.id)])
  return pages.filter((p) => !doomed.has(p.id))
}
