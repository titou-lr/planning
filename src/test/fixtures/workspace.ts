import type { WorkspaceData } from '../../core/types'

const at = '2026-09-21T10:00:00.000Z'

/** Jeu de données stable couvrant chaque famille persistée avant la migration. */
export const representativeWorkspace: WorkspaceData = {
  pages: [{
    id: 'page-root', title: 'Plan de lancement', icon: '🚀', parentId: null, order: 0,
    kind: 'page', createdAt: at, updatedAt: at,
    blocks: [
      { id: 'block-title', type: 'heading1', text: 'Migration cloud' },
      { id: 'block-todo', type: 'todo', text: 'Valider la sauvegarde', checked: false },
      { id: 'block-image', type: 'image', text: '', src: 'data:image/png;base64,iVBORw0KGgo=' },
    ],
  }],
  versions: {
    'page-root': [{ id: 'version-1', at, title: 'Plan initial', blocks: [] }],
  },
  statuses: [
    { id: 'todo', name: 'À faire', category: 'todo', color: 'cat-blue', order: 0 },
    { id: 'done', name: 'Terminé', category: 'done', color: 'cat-green', order: 1 },
  ],
  labels: [{ id: 'label-cloud', name: 'Cloud', color: 'cat-purple' }],
  projects: [{
    id: 'project-cloud', name: 'Migration', description: 'Passage PWA', color: 'cat-blue',
    health: 'active', startDate: '2026-09-21', targetDate: '2026-12-01', order: 0, createdAt: at,
  }],
  cycles: [{ id: 'cycle-0', name: 'Baseline', startDate: '2026-09-21', endDate: '2026-10-04' }],
  tasks: [{
    id: 'task-backup', title: 'Tester les sauvegardes', blocks: [], statusId: 'todo', priority: 1,
    labelIds: ['label-cloud'], projectId: 'project-cloud', cycleId: 'cycle-0', parentId: null,
    order: 0, dueDate: '2026-09-22', hardDeadline: true, estimateMin: 45,
    startDate: '2026-09-21', blockedBy: [], checklist: [{ id: 'check-1', text: 'Export', done: true }],
    attachments: [{ id: 'attachment-1', name: 'preuve.txt', src: 'data:text/plain;base64,b2s=' }],
    createdAt: at, updatedAt: at, completedAt: null,
  }],
  goals: [{
    id: 'goal-parity', name: 'Parité locale', description: 'Aucune régression',
    projectIds: ['project-cloud'], taskIds: ['task-backup'], targetDate: '2026-10-04', createdAt: at,
  }],
  savedTaskViews: [{ id: 'view-urgent', name: 'Urgent', view: 'list', filters: [], sorts: [] }],
  automations: [{
    id: 'automation-1', name: 'Clôture', enabled: true, trigger: 'task.completed',
    conditions: [], actions: [{ type: 'setPriority', value: 0 }],
  }],
  projectTemplates: [{
    id: 'template-1', name: 'Migration', description: 'Contrôles de migration',
    tasks: [{ title: 'Exporter', priority: 1, estimateMin: 15, parentIndex: null, dueInDays: 0 }],
  }],
  taskFields: [{ id: 'field-risk', name: 'Risque', type: 'select', options: [] }],
  events: [{
    id: 'event-review', title: 'Revue baseline', start: '2026-09-21T14:00:00',
    end: '2026-09-21T15:00:00', allDay: false, recurrence: null, exdates: [],
    reminderMin: 15, taskId: 'task-backup', color: 'cat-blue', notes: 'Valider les résultats',
  }],
  habits: [{
    id: 'habit-backup', name: 'Vérifier les sauvegardes', color: 'cat-teal', frequency: 'weekly',
    timesPerWeek: 1, completions: ['2026-09-21'], createdAt: at, archived: false,
  }],
  sessions: [{ id: 'session-1', taskId: 'task-backup', start: at, end: '2026-09-21T10:30:00.000Z' }],
}

export function makeLargeWorkspace(entityCount = 5_000): WorkspaceData {
  return {
    ...representativeWorkspace,
    pages: Array.from({ length: entityCount }, (_, index) => ({
      ...representativeWorkspace.pages[0],
      id: `page-${index}`,
      title: `Page ${index}`,
      order: index,
    })),
    tasks: Array.from({ length: entityCount }, (_, index) => ({
      ...representativeWorkspace.tasks[0],
      id: `task-${index}`,
      title: `Tâche ${index}`,
      order: index,
      attachments: [],
    })),
  }
}
