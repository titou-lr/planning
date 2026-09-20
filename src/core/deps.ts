import type { Task } from './types'

/**
 * Graphe de dépendances entre tâches (§6.3) : "bloqué par" / "bloque".
 * Moteur pur — détection de cycles avant ajout d'une arête, et
 * signalement des cycles existants (donnée importée par exemple).
 */

/** Adjacence : id → ids des tâches qui la bloquent. */
function graphOf(tasks: Task[]): Map<string, string[]> {
  const g = new Map<string, string[]>()
  const known = new Set(tasks.map((t) => t.id))
  for (const t of tasks) g.set(t.id, t.blockedBy.filter((b) => known.has(b)))
  return g
}

/** Ids des tâches qui bloquent `taskId` (directes). */
export function blockersOf(tasks: Task[], taskId: string): string[] {
  return tasks.find((t) => t.id === taskId)?.blockedBy ?? []
}

/** Ids des tâches bloquées par `taskId` (arêtes inverses). */
export function blockedByMe(tasks: Task[], taskId: string): string[] {
  return tasks.filter((t) => t.blockedBy.includes(taskId)).map((t) => t.id)
}

/**
 * Vrai si ajouter l'arête « `taskId` est bloquée par `blockerId` »
 * créerait un cycle. Auto-dépendance = cycle trivial.
 */
export function wouldCreateCycle(tasks: Task[], taskId: string, blockerId: string): boolean {
  if (taskId === blockerId) return true
  const g = graphOf(tasks)
  // Cycle ssi taskId est déjà atteignable depuis blockerId en suivant blockedBy
  const stack = [blockerId]
  const seen = new Set<string>()
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === taskId) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    for (const next of g.get(cur) ?? []) stack.push(next)
  }
  return false
}

/**
 * Détecte les cycles existants dans le graphe (DFS coloré). Retourne un
 * exemple de cycle par composante fautive : liste d'ids formant la boucle.
 */
export function findCycles(tasks: Task[]): string[][] {
  const g = graphOf(tasks)
  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  const cycles: string[][] = []
  const inReportedCycle = new Set<string>()

  function dfs(node: string, path: string[]): void {
    color.set(node, GRAY)
    path.push(node)
    for (const next of g.get(node) ?? []) {
      const c = color.get(next) ?? WHITE
      if (c === GRAY) {
        const start = path.indexOf(next)
        const cycle = path.slice(start)
        if (!cycle.some((id) => inReportedCycle.has(id))) {
          cycles.push(cycle)
          for (const id of cycle) inReportedCycle.add(id)
        }
      } else if (c === WHITE) {
        dfs(next, path)
      }
    }
    path.pop()
    color.set(node, BLACK)
  }

  for (const t of tasks) {
    if ((color.get(t.id) ?? WHITE) === WHITE) dfs(t.id, [])
  }
  return cycles
}

/** Une tâche est bloquée si au moins un de ses bloqueurs n'est pas terminé/annulé. */
export function isBlocked(tasks: Task[], taskId: string, isClosed: (statusId: string) => boolean): boolean {
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return false
  return task.blockedBy.some((id) => {
    const blocker = tasks.find((t) => t.id === id)
    return blocker != null && !isClosed(blocker.statusId)
  })
}
