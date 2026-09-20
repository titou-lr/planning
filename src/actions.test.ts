// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { ActionRegistry } from '@jarvis/action-registry'
import { planningActions } from './actions'
import { useStore } from './store/useStore'
import { normalizeWorkspace } from './core/workspace'

function makeRegistry() {
  const reg = new ActionRegistry()
  reg.registerAll(planningActions)
  return reg
}

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ data: normalizeWorkspace(null) })
})

describe('tools Jarvis — Planning', () => {
  it('create_task valide ses paramètres (titre requis, date au bon format)', () => {
    const reg = makeRegistry()
    expect(reg.validate('planning__create_task', { title: '' }).ok).toBe(false)
    expect(reg.validate('planning__create_task', { title: 'x', dueDate: '12/07/2026' }).ok).toBe(false)
    expect(reg.validate('planning__create_task', { title: 'x', dueDate: '2026-07-12', priority: 2 }).ok).toBe(true)
  })

  it('create_task délègue au store réel et undo supprime la tâche', async () => {
    const reg = makeRegistry()
    const res = await reg.execute('planning__create_task', { title: 'Préparer la réunion', dueDate: '2026-07-20' })
    expect(res.status).toBe('ok')
    const created = (res as { status: 'ok'; result: { taskId: string } }).result
    const task = useStore.getState().data.tasks.find((t) => t.id === created.taskId)
    expect(task?.title).toBe('Préparer la réunion')
    expect(task?.dueDate).toBe('2026-07-20')

    const def = reg.get('planning__create_task')!
    await def.undo!(created)
    expect(useStore.getState().data.tasks.find((t) => t.id === created.taskId)).toBeUndefined()
  })

  it('complete_task passe la tâche en statut done et undo restaure', async () => {
    const reg = makeRegistry()
    const created = await reg.execute('planning__create_task', { title: 'Tâche à finir' })
    const { taskId } = (created as { status: 'ok'; result: { taskId: string } }).result

    const res = await reg.execute('planning__complete_task', { title: 'tâche à finir' })
    expect(res.status).toBe('ok')
    const state = useStore.getState()
    const task = state.data.tasks.find((t) => t.id === taskId)!
    const status = state.data.statuses.find((s) => s.id === task.statusId)!
    expect(status.category).toBe('done')

    const def = reg.get('planning__complete_task')!
    await def.undo!((res as { status: 'ok'; result: unknown }).result)
    const after = useStore.getState().data.tasks.find((t) => t.id === taskId)!
    expect(useStore.getState().data.statuses.find((s) => s.id === after.statusId)!.category).not.toBe('done')
  })

  it('complete_task échoue proprement si la tâche est introuvable', async () => {
    const reg = makeRegistry()
    const res = await reg.execute('planning__complete_task', { title: 'inexistante' })
    expect(res.status).toBe('error')
  })

  it('delete_task est déclarée sensible (§7.4)', () => {
    const def = makeRegistry().get('planning__delete_task')!
    expect(def.impact).toBe('sensitive')
  })

  it('list_open_tasks ne compte pas les tâches terminées', async () => {
    const reg = makeRegistry()
    await reg.execute('planning__create_task', { title: 'Ouverte' })
    await reg.execute('planning__create_task', { title: 'Finie' })
    await reg.execute('planning__complete_task', { title: 'Finie' })
    const res = await reg.execute('planning__list_open_tasks', {})
    const { tasks } = (res as { status: 'ok'; result: { tasks: Array<{ title: string }> } }).result
    expect(tasks.map((t) => t.title)).toEqual(['Ouverte'])
  })
})
