import type {
  AutomationCondition, AutomationRule, AutomationTriggerType, FilterOp, PropValue, Task,
} from './types'
import { toDateKey } from './recurrence'

/**
 * Moteur d'automatisations (§6.8) : règles génériques
 * déclencheur → conditions → actions. Pur : produit un patch de tâche,
 * ne l'applique pas. Les patchs issus d'automatisations ne redéclenchent
 * pas de règles (appliqués en une passe par le store) — pas de boucle.
 */

function fieldValue(task: Task, field: AutomationCondition['field']): PropValue {
  switch (field) {
    case 'statusId': return task.statusId
    case 'priority': return task.priority
    case 'projectId': return task.projectId
    case 'cycleId': return task.cycleId
    case 'labelIds': return task.labelIds
    case 'title': return task.title
    case 'dueDate': return task.dueDate
  }
}

export function evalOp(op: FilterOp, actual: PropValue, expected: PropValue | undefined): boolean {
  const isEmpty =
    actual == null || actual === '' || (Array.isArray(actual) && actual.length === 0)
  switch (op) {
    case 'isEmpty': return isEmpty
    case 'isNotEmpty': return !isEmpty
    case 'equals':
      if (Array.isArray(actual)) return typeof expected === 'string' && actual.includes(expected)
      return actual === expected
    case 'notEquals':
      if (Array.isArray(actual)) return !(typeof expected === 'string' && actual.includes(expected))
      return actual !== expected
    case 'contains':
      if (Array.isArray(actual)) return typeof expected === 'string' && actual.includes(expected)
      return typeof actual === 'string' && typeof expected === 'string' &&
        actual.toLowerCase().includes(expected.toLowerCase())
    case 'gt': return typeof actual === 'number' && typeof expected === 'number' && actual > expected
    case 'lt': return typeof actual === 'number' && typeof expected === 'number' && actual < expected
  }
}

export function matchesConditions(task: Task, conditions: AutomationCondition[]): boolean {
  return conditions.every((c) => evalOp(c.op, fieldValue(task, c.field), c.value))
}

/**
 * Évalue les règles pour un déclencheur donné et retourne le patch
 * cumulé (les règles s'appliquent dans l'ordre, chacune voit la tâche
 * déjà patchée par les précédentes).
 */
export function runAutomations(
  rules: AutomationRule[],
  trigger: AutomationTriggerType,
  task: Task,
  now: Date
): Partial<Task> {
  let patched = task
  let patch: Partial<Task> = {}
  for (const rule of rules) {
    if (!rule.enabled || rule.trigger !== trigger) continue
    if (!matchesConditions(patched, rule.conditions)) continue
    for (const action of rule.actions) {
      let p: Partial<Task> = {}
      switch (action.type) {
        case 'setStatus':
          if (typeof action.value === 'string') p = { statusId: action.value }
          break
        case 'setPriority':
          if (typeof action.value === 'number' && action.value >= 0 && action.value <= 4) {
            p = { priority: action.value as Task['priority'] }
          }
          break
        case 'addLabel':
          if (typeof action.value === 'string' && !patched.labelIds.includes(action.value)) {
            p = { labelIds: [...patched.labelIds, action.value] }
          }
          break
        case 'setProject':
          p = { projectId: typeof action.value === 'string' && action.value ? action.value : null }
          break
        case 'setCycle':
          p = { cycleId: typeof action.value === 'string' && action.value ? action.value : null }
          break
        case 'setDueInDays':
          if (typeof action.value === 'number') {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + action.value)
            p = { dueDate: toDateKey(d) }
          }
          break
      }
      patch = { ...patch, ...p }
      patched = { ...patched, ...p }
    }
  }
  return patch
}
