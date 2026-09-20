import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { ActionImpact } from '@jarvis/shared-types'

/**
 * Registre d'actions Jarvis (CLAUDE.md §7.3).
 * Chaque module déclare ses tools : nom, schéma zod, fonction d'exécution qui
 * délègue à la logique métier existante du module. Le LLM ne voit que les
 * signatures (name/description/input_schema) — jamais le code.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ActionDefinition<S extends z.ZodTypeAny = z.ZodTypeAny, R = any> {
  /** Module propriétaire ('planning', 'earning', 'running'…). */
  module: string
  /** Nom court, unique dans le module (snake_case). */
  name: string
  /** Description en français, lisible par le LLM. */
  description: string
  /**
   * Niveau de confiance (§7.4) :
   * - 'routine'   → exécution directe, confirmation orale après coup ;
   * - 'sensitive' → confirmation explicite AVANT exécution, non négociable.
   */
  impact: ActionImpact
  schema: S
  /** Délègue à la logique métier du module — jamais de logique dupliquée ici. */
  execute: (params: z.infer<S>) => R | Promise<R>
  /** Annulation a posteriori depuis le journal d'audit, si disponible. */
  undo?: (result: R) => void | Promise<void>
}

export interface AnthropicTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export type ValidationResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string }

export type ExecutionResult =
  | { status: 'ok'; result: unknown }
  | { status: 'error'; error: string }

/** Nom qualifié exposé au LLM : `module__action` (Anthropic exige [a-zA-Z0-9_-]). */
export function qualifiedName(def: Pick<ActionDefinition, 'module' | 'name'>): string {
  return `${def.module}__${def.name}`
}

export class ActionRegistry {
  private actions = new Map<string, ActionDefinition>()

  register(def: ActionDefinition): void {
    const key = qualifiedName(def)
    if (this.actions.has(key)) {
      throw new Error(`action-registry: action déjà déclarée « ${key} »`)
    }
    this.actions.set(key, def)
  }

  registerAll(defs: ActionDefinition[]): void {
    for (const def of defs) this.register(def)
  }

  get(qualified: string): ActionDefinition | undefined {
    return this.actions.get(qualified)
  }

  list(): ActionDefinition[] {
    return [...this.actions.values()]
  }

  /** Signatures exposées au LLM au moment de l'appel (CLAUDE.md §7.3). */
  toAnthropicTools(): AnthropicTool[] {
    return this.list().map((def) => ({
      name: qualifiedName(def),
      description: `[Module ${def.module}] ${def.description}`,
      input_schema: zodToJsonSchema(def.schema, { $refStrategy: 'none' }) as Record<string, unknown>,
    }))
  }

  /** Validation stricte AVANT toute exécution — un appel mal formé est rejeté (§7.4). */
  validate(qualified: string, rawParams: unknown): ValidationResult {
    const def = this.actions.get(qualified)
    if (!def) return { ok: false, error: `Action inconnue : ${qualified}` }
    const parsed = def.schema.safeParse(rawParams)
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(racine)'} : ${i.message}`)
        .join(' ; ')
      return { ok: false, error: `Paramètres invalides — ${issues}` }
    }
    return { ok: true, data: parsed.data }
  }

  /** Valide puis délègue l'exécution au module. Ne lève jamais : résultat typé. */
  async execute(qualified: string, rawParams: unknown): Promise<ExecutionResult> {
    const def = this.actions.get(qualified)
    if (!def) return { status: 'error', error: `Action inconnue : ${qualified}` }
    const validation = this.validate(qualified, rawParams)
    if (!validation.ok) return { status: 'error', error: validation.error }
    try {
      const result = await def.execute(validation.data)
      return { status: 'ok', result }
    } catch (e) {
      return { status: 'error', error: e instanceof Error ? e.message : String(e) }
    }
  }
}

export { z }
