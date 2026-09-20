import { z, type ActionDefinition } from '@jarvis/action-registry'
import { useStore } from './store/useStore'
import { isClosedStatus } from './core/taskquery'
import { computeInsights } from './core/ai/insights'
import type { Task } from './core/types'

/**
 * Tools Jarvis du module Planning (CLAUDE.md shell §7.3).
 * Chaque exécution délègue aux actions du store existant (createTask,
 * updateTask…), qui passent toutes par l'undo/redo global du module —
 * condition d'entrée au registre (§7.4). Aucune logique métier ici.
 */

const createTaskSchema = z.object({
  title: z.string().min(1).describe('Titre de la tâche'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe('Échéance au format YYYY-MM-DD, si demandée'),
  priority: z.number().int().min(0).max(4).optional()
    .describe('Priorité 0 (aucune) à 4 (urgente)'),
})

const completeTaskSchema = z.object({
  title: z.string().min(1).describe('Titre (ou début de titre) de la tâche à terminer'),
})

const deleteTaskSchema = z.object({
  title: z.string().min(1).describe('Titre exact ou début de titre de la tâche à supprimer'),
})

function findOpenTask(title: string) {
  const { data } = useStore.getState()
  const needle = title.trim().toLowerCase()
  return data.tasks.find(
    (t) => !isClosedStatus(data.statuses, t.statusId) && t.title.toLowerCase().includes(needle)
  )
}

export const planningActions: ActionDefinition[] = [
  {
    module: 'planning',
    name: 'create_task',
    description: 'Crée une tâche (titre, échéance et priorité optionnelles).',
    impact: 'routine',
    schema: createTaskSchema,
    execute: (p: z.infer<typeof createTaskSchema>) => {
      const id = useStore.getState().createTask({
        title: p.title,
        ...(p.dueDate ? { dueDate: p.dueDate } : {}),
        ...(p.priority !== undefined ? { priority: p.priority as Task['priority'] } : {}),
      })
      return { taskId: id, title: p.title, dueDate: p.dueDate ?? null }
    },
    undo: (result: { taskId: string }) => {
      useStore.getState().deleteTask(result.taskId)
    },
  },
  {
    module: 'planning',
    name: 'list_open_tasks',
    description: 'Liste les tâches ouvertes (lecture seule), triées par échéance puis priorité.',
    impact: 'routine',
    schema: z.object({}),
    execute: () => {
      const { data } = useStore.getState()
      const open = data.tasks
        .filter((t) => !isClosedStatus(data.statuses, t.statusId))
        .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || b.priority - a.priority)
        .slice(0, 20)
        .map((t) => ({
          title: t.title || '(sans titre)',
          dueDate: t.dueDate,
          priority: t.priority,
          status: data.statuses.find((s) => s.id === t.statusId)?.name ?? '?',
          project: data.projects.find((p) => p.id === t.projectId)?.name ?? null,
        }))
      return { count: open.length, tasks: open }
    },
  },
  {
    module: 'planning',
    name: 'get_briefing',
    description:
      'Point de situation Planning (lecture seule) : retards, échéances imminentes, charge de la semaine, avancement projets/objectifs. À utiliser pour signaler spontanément ce qui mérite attention.',
    impact: 'routine',
    schema: z.object({}),
    execute: () => {
      // Réutilise le moteur d'insights existant (§8) — aucune logique dupliquée.
      const { lines } = computeInsights(useStore.getState().data, new Date())
      return { module: 'planning', lines }
    },
  },
  {
    module: 'planning',
    name: 'complete_task',
    description: 'Marque une tâche ouverte comme terminée, retrouvée par son titre.',
    impact: 'routine',
    schema: completeTaskSchema,
    execute: (p: z.infer<typeof completeTaskSchema>) => {
      const state = useStore.getState()
      const task = findOpenTask(p.title)
      if (!task) throw new Error(`Aucune tâche ouverte trouvée pour « ${p.title} »`)
      const done = [...state.data.statuses]
        .sort((a, b) => a.order - b.order)
        .find((s) => s.category === 'done')
      if (!done) throw new Error('Aucun statut « terminé » dans le workflow')
      const previousStatusId = task.statusId
      state.updateTask(task.id, { statusId: done.id })
      return { taskId: task.id, title: task.title, previousStatusId }
    },
    undo: (result: { taskId: string; previousStatusId: string }) => {
      useStore.getState().updateTask(result.taskId, { statusId: result.previousStatusId })
    },
  },
  {
    module: 'planning',
    name: 'delete_task',
    description: 'Supprime définitivement une tâche (et ses sous-tâches), retrouvée par son titre.',
    impact: 'sensitive',
    schema: deleteTaskSchema,
    execute: (p: z.infer<typeof deleteTaskSchema>) => {
      const task = findOpenTask(p.title)
      if (!task) throw new Error(`Aucune tâche ouverte trouvée pour « ${p.title} »`)
      useStore.getState().deleteTask(task.id)
      return { taskId: task.id, title: task.title }
    },
    // Pas d'undo direct exposé ici : la suppression reste couverte par
    // l'undo global du module (Ctrl+Z dans Planning).
  },
]
