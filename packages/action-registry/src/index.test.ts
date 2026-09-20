import { describe, it, expect } from 'vitest'
import { ActionRegistry, qualifiedName, z, type ActionDefinition } from './index'

function makeAction(overrides: Partial<ActionDefinition> = {}): ActionDefinition {
  return {
    module: 'demo',
    name: 'create_thing',
    description: 'Crée une chose',
    impact: 'routine',
    schema: z.object({ title: z.string().min(1), count: z.number().int().positive().optional() }),
    execute: (p: { title: string }) => ({ id: 'x1', title: p.title }),
    ...overrides,
  } as ActionDefinition
}

describe('ActionRegistry', () => {
  it('enregistre et liste les actions, refuse les doublons', () => {
    const reg = new ActionRegistry()
    reg.register(makeAction())
    expect(reg.list()).toHaveLength(1)
    expect(() => reg.register(makeAction())).toThrow(/déjà déclarée/)
  })

  it('expose les signatures Anthropic avec nom qualifié et JSON schema', () => {
    const reg = new ActionRegistry()
    reg.register(makeAction())
    const tools = reg.toAnthropicTools()
    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('demo__create_thing')
    expect(tools[0].description).toContain('Module demo')
    const schema = tools[0].input_schema as { type: string; properties: Record<string, unknown>; required?: string[] }
    expect(schema.type).toBe('object')
    expect(Object.keys(schema.properties)).toContain('title')
    expect(schema.required).toContain('title')
    expect(schema.required ?? []).not.toContain('count')
  })

  it('rejette un appel mal formé AVANT exécution', async () => {
    const reg = new ActionRegistry()
    let executed = false
    reg.register(makeAction({ execute: () => { executed = true; return null } }))
    const res = await reg.execute('demo__create_thing', { title: '' })
    expect(res.status).toBe('error')
    expect(executed).toBe(false)
    const res2 = await reg.execute('demo__create_thing', { count: 3 })
    expect(res2.status).toBe('error')
    expect(executed).toBe(false)
  })

  it('rejette les champs de type invalide (coercition interdite)', () => {
    const reg = new ActionRegistry()
    reg.register(makeAction())
    const v = reg.validate('demo__create_thing', { title: 'ok', count: '3' })
    expect(v.ok).toBe(false)
  })

  it('exécute une action valide et retourne le résultat', async () => {
    const reg = new ActionRegistry()
    reg.register(makeAction())
    const res = await reg.execute('demo__create_thing', { title: 'Bonjour' })
    expect(res).toEqual({ status: 'ok', result: { id: 'x1', title: 'Bonjour' } })
  })

  it("capture les exceptions d'exécution en résultat d'erreur", async () => {
    const reg = new ActionRegistry()
    reg.register(makeAction({ execute: () => { throw new Error('boum métier') } }))
    const res = await reg.execute('demo__create_thing', { title: 'x' })
    expect(res).toEqual({ status: 'error', error: 'boum métier' })
  })

  it('action inconnue → erreur propre', async () => {
    const reg = new ActionRegistry()
    const res = await reg.execute('nope__rien', {})
    expect(res.status).toBe('error')
  })

  it('qualifiedName est stable module__name', () => {
    expect(qualifiedName({ module: 'earning', name: 'add_line' })).toBe('earning__add_line')
  })
})
