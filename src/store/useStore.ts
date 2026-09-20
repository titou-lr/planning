import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  AutomationRule, Block, CalendarEvent, Cycle, DatabaseSchema, Filter, Goal, Habit, Label,
  Page, PageKind, Project, ProjectTemplate, PropertyDef, PropValue, SavedTaskView,
  Sort, Task, TaskStatus, ViewDef, WorkspaceData,
} from '../core/types'
import { uid } from '../core/id'
import { deleteSubtree, movePage as movePageTree, nextOrder, findPage } from '../core/tree'
import { defaultSchema } from '../core/database'
import { recordVersion } from '../core/versions'
import { emptyStacks, pushSnapshot, undo as undoOp, redo as redoOp, type UndoStacks } from '../core/undoable'
import { normalizeWorkspace } from '../core/workspace'
import { runAutomations } from '../core/automations'
import { wouldCreateCycle } from '../core/deps'
import { isClosedStatus, isDoneStatus } from '../core/taskquery'
import {
  detachTaskBlocks, dropFutureBlocksOfClosedTask, resizeFutureBlocks,
} from '../core/timeblock'
import { toDateKey } from '../core/recurrence'
import type { Placement } from '../core/scheduling'
import { getStoreKey } from './profileService'
import { secureStorage } from './secureStorage'

/** Sections de navigation de l'app (sidebar). */
export type AppSection =
  | 'home' | 'notes'
  | 'tasks' | 'projects' | 'cycles' | 'goals' | 'reports' | 'automations'
  | 'calendar' | 'habits'

/**
 * Store global — la clé localStorage est dérivée du profil actif au
 * moment de la création (la sélection de profil recharge l'app, même
 * pattern que Patrimoine Manager). Seule `data` est persistée ; les
 * piles d'undo restent en mémoire.
 */

interface StoreState {
  data: WorkspaceData
  currentPageId: string | null
  expanded: Record<string, boolean>
  /** Vue active par base de données. */
  activeView: Record<string, string>
  undoStacks: UndoStacks<WorkspaceData>
  /** Navigation entre modules (notes / tâches / calendrier…). */
  section: AppSection
  /** Tâche ouverte dans le panneau de détail. */
  selectedTaskId: string | null
  /** Projet ouvert en détail (section projects). */
  selectedProjectId: string | null

  setCurrentPage: (id: string | null) => void
  setSection: (s: AppSection) => void
  setSelectedTask: (id: string | null) => void
  setSelectedProject: (id: string | null) => void
  toggleExpanded: (id: string) => void
  setActiveView: (dbId: string, viewId: string) => void

  // ---- Tâches & projets (§6) ----
  createTask: (patch?: Partial<Task>) => string
  updateTask: (id: string, patch: Partial<Task>, coalesceKey?: string) => void
  deleteTask: (id: string) => void
  /** Ajoute « id bloquée par blockerId ». Refuse (false) si cycle. */
  addDependency: (id: string, blockerId: string) => boolean
  removeDependency: (id: string, blockerId: string) => void
  addStatus: (s: Omit<TaskStatus, 'id' | 'order'>) => void
  updateStatus: (id: string, patch: Partial<TaskStatus>) => void
  deleteStatus: (id: string) => void
  addLabel: (name: string, color: string) => string
  updateLabel: (id: string, patch: Partial<Label>) => void
  deleteLabel: (id: string) => void
  addTaskField: (f: PropertyDef) => void
  updateTaskField: (id: string, patch: Partial<PropertyDef>) => void
  removeTaskField: (id: string) => void
  createProject: (patch?: Partial<Project>) => string
  updateProject: (id: string, patch: Partial<Project>) => void
  deleteProject: (id: string) => void
  createProjectFromTemplate: (templateId: string, name?: string) => string | null
  saveProjectAsTemplate: (projectId: string, name: string) => void
  deleteProjectTemplate: (id: string) => void
  createCycle: (patch?: Partial<Cycle>) => string
  updateCycle: (id: string, patch: Partial<Cycle>) => void
  deleteCycle: (id: string) => void
  createGoal: (patch?: Partial<Goal>) => string
  updateGoal: (id: string, patch: Partial<Goal>) => void
  deleteGoal: (id: string) => void
  saveTaskView: (v: Omit<SavedTaskView, 'id'>) => string
  deleteTaskView: (id: string) => void
  addAutomation: (r: Omit<AutomationRule, 'id'>) => string
  updateAutomation: (id: string, patch: Partial<AutomationRule>) => void
  deleteAutomation: (id: string) => void
  /** Déclencheur périodique « échéance proche » (une fois par tâche et par échéance). */
  runDueSoonAutomations: (now: Date) => void

  // ---- Calendrier & planification (§7) ----
  createEvent: (patch?: Partial<CalendarEvent>) => string
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void
  deleteEvent: (id: string) => void
  /** Exclut une occurrence d'un événement récurrent. */
  excludeOccurrence: (eventId: string, occStartISO: string) => void
  /** Time-blocking : pose la tâche sur un créneau (durée = estimation). */
  scheduleTaskBlock: (taskId: string, start: Date) => string | null
  /** Applique des placements confirmés du planificateur (§7.6). */
  applyPlan: (placements: Placement[]) => void
  createHabit: (patch?: Partial<Habit>) => string
  updateHabit: (id: string, patch: Partial<Habit>) => void
  deleteHabit: (id: string) => void
  toggleHabitDay: (id: string, dateKey: string) => void
  /** Chronomètre : ouvre une session (ferme la précédente). */
  startTimer: (taskId: string) => void
  stopTimer: () => void

  // Mutations (toutes passent par l'undo global)
  createPage: (parentId: string | null, kind?: PageKind, title?: string) => string
  createDatabase: (parentId: string | null, title?: string) => string
  createFromTemplate: (templateId: string, parentId: string | null) => string | null
  insertPage: (page: Omit<Page, 'order' | 'createdAt' | 'updatedAt'>) => void
  renamePage: (id: string, title: string) => void
  setPageIcon: (id: string, icon: string) => void
  deletePage: (id: string) => void
  movePage: (id: string, newParentId: string | null, index: number) => void
  setBlocks: (pageId: string, blocks: Block[], coalesceKey?: string) => void
  setProp: (pageId: string, propId: string, value: PropValue) => void

  // Schéma de base de données
  updateSchema: (dbId: string, fn: (s: DatabaseSchema) => DatabaseSchema) => void
  addProperty: (dbId: string, prop: PropertyDef) => void
  updateProperty: (dbId: string, propId: string, patch: Partial<PropertyDef>) => void
  removeProperty: (dbId: string, propId: string) => void
  addView: (dbId: string, view: ViewDef) => void
  updateView: (dbId: string, viewId: string, patch: Partial<Pick<ViewDef, 'name' | 'filters' | 'sorts' | 'groupBy' | 'visibleProps' | 'dateProp'>> & { filters?: Filter[]; sorts?: Sort[] }) => void
  removeView: (dbId: string, viewId: string) => void

  // Versions
  snapshotVersion: (pageId: string) => void
  restoreVersion: (pageId: string, versionId: string) => void

  // Import / restauration
  replaceData: (data: WorkspaceData) => void

  undo: () => void
  redo: () => void
}

function now(): string {
  return new Date().toISOString()
}

function touch(p: Page): Page {
  return { ...p, updatedAt: now() }
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => {
      /** Applique une mutation de data en empilant le snapshot d'undo. */
      function mutate(fn: (data: WorkspaceData) => WorkspaceData, coalesceKey: string | null = null) {
        const { data, undoStacks } = get()
        const next = fn(data)
        if (next === data) return
        set({
          data: next,
          undoStacks: pushSnapshot(undoStacks, data, coalesceKey, Date.now()),
        })
      }

      function mutatePage(id: string, fn: (p: Page) => Page, coalesceKey: string | null = null) {
        mutate((d) => {
          const page = findPage(d.pages, id)
          if (!page) return d
          return { ...d, pages: d.pages.map((p) => (p.id === id ? touch(fn(p)) : p)) }
        }, coalesceKey)
      }

      /** Statut de repli (premier du workflow) — toujours défini après normalisation. */
      function fallbackStatusId(d: WorkspaceData): string {
        return [...d.statuses].sort((a, b) => a.order - b.order)[0]?.id ?? ''
      }

      /**
       * Applique un patch à une tâche + toute la logique dérivée :
       * automatisations (une passe, sans redéclenchement), completedAt,
       * cohérence des créneaux de time-blocking (§7.2).
       */
      function applyTaskPatch(
        d: WorkspaceData,
        task: Task,
        patch: Partial<Task>,
        opts: { trigger?: 'task.created' | 'task.statusChanged' | 'task.completed' | 'task.dueSoon' | null }
      ): WorkspaceData {
        const nowDate = new Date()
        let next: Task = { ...task, ...patch, updatedAt: now() }

        // Automatisations : le patch produit est appliqué dans la même passe
        if (opts.trigger) {
          const auto = runAutomations(d.automations, opts.trigger, next, nowDate)
          next = { ...next, ...auto }
          if (opts.trigger === 'task.statusChanged' && isDoneStatus(d.statuses, next.statusId)) {
            const completedPatch = runAutomations(d.automations, 'task.completed', next, nowDate)
            next = { ...next, ...completedPatch }
          }
        }

        // completedAt suit la catégorie du statut
        const wasDone = isDoneStatus(d.statuses, task.statusId)
        const isDoneNow = isDoneStatus(d.statuses, next.statusId)
        if (!wasDone && isDoneNow) next = { ...next, completedAt: now() }
        else if (wasDone && !isDoneNow) next = { ...next, completedAt: null }

        // Cohérence time-blocking (§7.2)
        let events = d.events
        if (next.estimateMin !== task.estimateMin) {
          events = resizeFutureBlocks(events, task.id, next.estimateMin, nowDate)
        }
        const wasClosed = isClosedStatus(d.statuses, task.statusId)
        if (!wasClosed && isClosedStatus(d.statuses, next.statusId)) {
          events = dropFutureBlocksOfClosedTask(events, task.id, nowDate)
        }

        return {
          ...d,
          tasks: d.tasks.map((t) => (t.id === task.id ? next : t)),
          events,
        }
      }

      return {
        data: normalizeWorkspace(null),
        currentPageId: null,
        expanded: {},
        activeView: {},
        undoStacks: emptyStacks<WorkspaceData>(),
        section: 'home' as AppSection,
        selectedTaskId: null,
        selectedProjectId: null,

        setCurrentPage: (id) => set({ currentPageId: id, ...(id ? { section: 'notes' as AppSection } : {}) }),
        setSection: (section) => set({ section }),
        setSelectedTask: (selectedTaskId) => set({ selectedTaskId }),
        setSelectedProject: (selectedProjectId) => set({ selectedProjectId }),
        toggleExpanded: (id) =>
          set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
        setActiveView: (dbId, viewId) =>
          set((s) => ({ activeView: { ...s.activeView, [dbId]: viewId } })),

        createPage: (parentId, kind = 'page', title = '') => {
          const id = uid()
          mutate((d) => ({
            ...d,
            pages: [
              ...d.pages,
              {
                id, title, parentId, kind,
                order: nextOrder(d.pages, parentId),
                blocks: [{ id: uid(), type: 'paragraph', text: '' }],
                createdAt: now(), updatedAt: now(),
              },
            ],
          }))
          return id
        },

        createDatabase: (parentId, title = 'Nouvelle base') => {
          const id = uid()
          mutate((d) => ({
            ...d,
            pages: [
              ...d.pages,
              {
                id, title, parentId, kind: 'database' as const,
                order: nextOrder(d.pages, parentId),
                blocks: [], schema: defaultSchema(),
                createdAt: now(), updatedAt: now(),
              },
            ],
          }))
          return id
        },

        createFromTemplate: (templateId, parentId) => {
          const { data } = get()
          const tpl = findPage(data.pages, templateId)
          if (!tpl) return null
          const id = uid()
          mutate((d) => ({
            ...d,
            pages: [
              ...d.pages,
              {
                ...JSON.parse(JSON.stringify(tpl)) as Page,
                id,
                kind: 'page' as const,
                title: tpl.title,
                parentId,
                order: nextOrder(d.pages, parentId),
                blocks: (JSON.parse(JSON.stringify(tpl.blocks)) as Block[]).map((b) => ({ ...b, id: uid() })),
                createdAt: now(), updatedAt: now(),
              },
            ],
          }))
          return id
        },

        insertPage: (page) => {
          mutate((d) => ({
            ...d,
            pages: [
              ...d.pages,
              { ...page, order: nextOrder(d.pages, page.parentId), createdAt: now(), updatedAt: now() },
            ],
          }))
        },

        renamePage: (id, title) => mutatePage(id, (p) => ({ ...p, title }), `rename:${id}`),
        setPageIcon: (id, icon) => mutatePage(id, (p) => ({ ...p, icon })),

        deletePage: (id) => {
          mutate((d) => {
            const doomedIds = new Set([id])
            const pages = deleteSubtree(d.pages, id)
            for (const p of d.pages) if (!pages.includes(p)) doomedIds.add(p.id)
            const versions = { ...d.versions }
            for (const doomed of doomedIds) delete versions[doomed]
            return { ...d, pages, versions }
          })
          if (get().currentPageId === id) set({ currentPageId: null })
        },

        movePage: (id, newParentId, index) =>
          mutate((d) => {
            const moved = movePageTree(d.pages, id, newParentId, index)
            return moved === d.pages ? d : { ...d, pages: moved }
          }),

        setBlocks: (pageId, blocks, coalesceKey) =>
          mutatePage(pageId, (p) => ({ ...p, blocks }), coalesceKey ?? `blocks:${pageId}`),

        setProp: (pageId, propId, value) =>
          mutatePage(pageId, (p) => ({ ...p, props: { ...p.props, [propId]: value } }), `prop:${pageId}:${propId}`),

        // ================= Tâches & projets (§6) =================

        createTask: (patch = {}) => {
          const id = uid()
          mutate((d) => {
            const base: Task = {
              id,
              title: '',
              blocks: [{ id: uid(), type: 'paragraph', text: '' }],
              statusId: fallbackStatusId(d),
              priority: 0,
              labelIds: [],
              projectId: null,
              cycleId: null,
              parentId: null,
              order: Math.max(0, ...d.tasks.map((t) => t.order + 1)),
              dueDate: null,
              hardDeadline: false,
              estimateMin: null,
              startDate: null,
              blockedBy: [],
              checklist: [],
              attachments: [],
              createdAt: now(),
              updatedAt: now(),
              completedAt: null,
              ...patch,
            }
            return applyTaskPatch({ ...d, tasks: [...d.tasks, base] }, base, {}, { trigger: 'task.created' })
          })
          return id
        },

        updateTask: (id, patch, coalesceKey) => {
          mutate((d) => {
            const task = d.tasks.find((t) => t.id === id)
            if (!task) return d
            const statusChanged = patch.statusId !== undefined && patch.statusId !== task.statusId
            return applyTaskPatch(d, task, patch, { trigger: statusChanged ? 'task.statusChanged' : null })
          }, coalesceKey ?? null)
        },

        deleteTask: (id) => {
          mutate((d) => {
            // Sous-tâches supprimées récursivement
            const doomed = new Set<string>([id])
            let grew = true
            while (grew) {
              grew = false
              for (const t of d.tasks) {
                if (t.parentId && doomed.has(t.parentId) && !doomed.has(t.id)) {
                  doomed.add(t.id)
                  grew = true
                }
              }
            }
            let events = d.events
            for (const tid of doomed) {
              const t = d.tasks.find((x) => x.id === tid)
              if (t) events = detachTaskBlocks(events, t, new Date())
            }
            return {
              ...d,
              tasks: d.tasks
                .filter((t) => !doomed.has(t.id))
                .map((t) => t.blockedBy.some((b) => doomed.has(b))
                  ? { ...t, blockedBy: t.blockedBy.filter((b) => !doomed.has(b)) }
                  : t),
              goals: d.goals.map((g) => g.taskIds.some((t) => doomed.has(t))
                ? { ...g, taskIds: g.taskIds.filter((t) => !doomed.has(t)) }
                : g),
              sessions: d.sessions.filter((s) => !doomed.has(s.taskId)),
              events,
            }
          })
          if (get().selectedTaskId === id) set({ selectedTaskId: null })
        },

        addDependency: (id, blockerId) => {
          const { data } = get()
          if (wouldCreateCycle(data.tasks, id, blockerId)) return false
          mutate((d) => ({
            ...d,
            tasks: d.tasks.map((t) =>
              t.id === id && !t.blockedBy.includes(blockerId)
                ? { ...t, blockedBy: [...t.blockedBy, blockerId], updatedAt: now() }
                : t),
          }))
          return true
        },

        removeDependency: (id, blockerId) =>
          mutate((d) => ({
            ...d,
            tasks: d.tasks.map((t) =>
              t.id === id ? { ...t, blockedBy: t.blockedBy.filter((b) => b !== blockerId) } : t),
          })),

        addStatus: (s) =>
          mutate((d) => ({
            ...d,
            statuses: [...d.statuses, { ...s, id: uid(), order: Math.max(0, ...d.statuses.map((x) => x.order + 1)) }],
          })),

        updateStatus: (id, patch) =>
          mutate((d) => ({
            ...d,
            statuses: d.statuses.map((s) => (s.id === id ? { ...s, ...patch } : s)),
          })),

        deleteStatus: (id) =>
          mutate((d) => {
            if (d.statuses.length <= 1) return d // toujours au moins un statut
            const statuses = d.statuses.filter((s) => s.id !== id)
            const fallback = [...statuses].sort((a, b) => a.order - b.order)[0].id
            return {
              ...d,
              statuses,
              tasks: d.tasks.map((t) => (t.statusId === id ? { ...t, statusId: fallback } : t)),
            }
          }),

        addLabel: (name, color) => {
          const id = uid()
          mutate((d) => ({ ...d, labels: [...d.labels, { id, name, color }] }))
          return id
        },

        updateLabel: (id, patch) =>
          mutate((d) => ({ ...d, labels: d.labels.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),

        deleteLabel: (id) =>
          mutate((d) => ({
            ...d,
            labels: d.labels.filter((l) => l.id !== id),
            tasks: d.tasks.map((t) =>
              t.labelIds.includes(id) ? { ...t, labelIds: t.labelIds.filter((l) => l !== id) } : t),
          })),

        addTaskField: (f) => mutate((d) => ({ ...d, taskFields: [...d.taskFields, f] })),
        updateTaskField: (id, patch) =>
          mutate((d) => ({ ...d, taskFields: d.taskFields.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
        removeTaskField: (id) =>
          mutate((d) => ({ ...d, taskFields: d.taskFields.filter((f) => f.id !== id) })),

        createProject: (patch = {}) => {
          const id = uid()
          mutate((d) => ({
            ...d,
            projects: [
              ...d.projects,
              {
                id, name: '', description: '', color: 'cat-blue', health: 'active' as const,
                startDate: null, targetDate: null,
                order: Math.max(0, ...d.projects.map((p) => p.order + 1)),
                createdAt: now(),
                ...patch,
              },
            ],
          }))
          return id
        },

        updateProject: (id, patch) =>
          mutate((d) => ({ ...d, projects: d.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

        deleteProject: (id) => {
          mutate((d) => ({
            ...d,
            projects: d.projects.filter((p) => p.id !== id),
            tasks: d.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)),
            goals: d.goals.map((g) =>
              g.projectIds.includes(id) ? { ...g, projectIds: g.projectIds.filter((p) => p !== id) } : g),
          }))
          if (get().selectedProjectId === id) set({ selectedProjectId: null })
        },

        createProjectFromTemplate: (templateId, name) => {
          const tpl = get().data.projectTemplates.find((t) => t.id === templateId)
          if (!tpl) return null
          const projectId = uid()
          mutate((d) => {
            const base = new Date()
            const ids = tpl.tasks.map(() => uid())
            const statusId = fallbackStatusId(d)
            const startOrder = Math.max(0, ...d.tasks.map((t) => t.order + 1))
            const tasks: Task[] = tpl.tasks.map((tt, i) => ({
              id: ids[i],
              title: tt.title,
              blocks: [{ id: uid(), type: 'paragraph' as const, text: '' }],
              statusId,
              priority: tt.priority,
              labelIds: [],
              projectId,
              cycleId: null,
              parentId: tt.parentIndex != null ? ids[tt.parentIndex] ?? null : null,
              order: startOrder + i,
              dueDate: tt.dueInDays != null
                ? toDateKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() + tt.dueInDays))
                : null,
              hardDeadline: false,
              estimateMin: tt.estimateMin,
              startDate: null,
              blockedBy: [],
              checklist: [],
              attachments: [],
              createdAt: now(), updatedAt: now(), completedAt: null,
            }))
            return {
              ...d,
              projects: [
                ...d.projects,
                {
                  id: projectId, name: name ?? tpl.name, description: tpl.description,
                  color: 'cat-blue', health: 'active' as const,
                  startDate: toDateKey(base), targetDate: null,
                  order: Math.max(0, ...d.projects.map((p) => p.order + 1)),
                  createdAt: now(),
                },
              ],
              tasks: [...d.tasks, ...tasks],
            }
          })
          return projectId
        },

        saveProjectAsTemplate: (projectId, name) =>
          mutate((d) => {
            const inProject = d.tasks.filter((t) => t.projectId === projectId)
            const index = new Map(inProject.map((t, i) => [t.id, i]))
            const project = d.projects.find((p) => p.id === projectId)
            const tpl: ProjectTemplate = {
              id: uid(),
              name,
              description: project?.description ?? '',
              tasks: inProject.map((t) => ({
                title: t.title,
                priority: t.priority,
                estimateMin: t.estimateMin,
                parentIndex: t.parentId != null ? index.get(t.parentId) ?? null : null,
                dueInDays: null,
              })),
            }
            return { ...d, projectTemplates: [...d.projectTemplates, tpl] }
          }),

        deleteProjectTemplate: (id) =>
          mutate((d) => ({ ...d, projectTemplates: d.projectTemplates.filter((t) => t.id !== id) })),

        createCycle: (patch = {}) => {
          const id = uid()
          mutate((d) => {
            const base = new Date()
            const start = toDateKey(base)
            const end = toDateKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 13))
            return {
              ...d,
              cycles: [...d.cycles, { id, name: `Cycle ${d.cycles.length + 1}`, startDate: start, endDate: end, ...patch }],
            }
          })
          return id
        },

        updateCycle: (id, patch) =>
          mutate((d) => ({ ...d, cycles: d.cycles.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

        deleteCycle: (id) =>
          mutate((d) => ({
            ...d,
            cycles: d.cycles.filter((c) => c.id !== id),
            tasks: d.tasks.map((t) => (t.cycleId === id ? { ...t, cycleId: null } : t)),
          })),

        createGoal: (patch = {}) => {
          const id = uid()
          mutate((d) => ({
            ...d,
            goals: [
              ...d.goals,
              { id, name: '', description: '', projectIds: [], taskIds: [], targetDate: null, createdAt: now(), ...patch },
            ],
          }))
          return id
        },

        updateGoal: (id, patch) =>
          mutate((d) => ({ ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),

        deleteGoal: (id) => mutate((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) })),

        saveTaskView: (v) => {
          const id = uid()
          mutate((d) => ({ ...d, savedTaskViews: [...d.savedTaskViews, { ...v, id }] }))
          return id
        },

        deleteTaskView: (id) =>
          mutate((d) => ({ ...d, savedTaskViews: d.savedTaskViews.filter((v) => v.id !== id) })),

        addAutomation: (r) => {
          const id = uid()
          mutate((d) => ({ ...d, automations: [...d.automations, { ...r, id }] }))
          return id
        },

        updateAutomation: (id, patch) =>
          mutate((d) => ({ ...d, automations: d.automations.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),

        deleteAutomation: (id) =>
          mutate((d) => ({ ...d, automations: d.automations.filter((r) => r.id !== id) })),

        runDueSoonAutomations: (nowDate) => {
          const { data } = get()
          const hasDueSoonRules = data.automations.some((r) => r.enabled && r.trigger === 'task.dueSoon')
          if (!hasDueSoonRules) return
          const today = toDateKey(nowDate)
          const tomorrow = toDateKey(new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + 1))
          const candidates = data.tasks.filter((t) =>
            t.dueDate != null &&
            (t.dueDate === today || t.dueDate === tomorrow) &&
            !isClosedStatus(data.statuses, t.statusId) &&
            t.meta?.dueSoonFor !== t.dueDate // une seule fois par échéance
          )
          if (!candidates.length) return
          mutate((d) => {
            let next = d
            for (const task of candidates) {
              const cur = next.tasks.find((t) => t.id === task.id)
              if (!cur) continue
              next = applyTaskPatch(next, cur, { meta: { ...cur.meta, dueSoonFor: cur.dueDate } }, { trigger: 'task.dueSoon' })
            }
            return next
          })
        },

        // ================= Calendrier & planification (§7) =================

        createEvent: (patch = {}) => {
          const id = uid()
          mutate((d) => {
            const start = new Date()
            start.setMinutes(0, 0, 0)
            start.setHours(start.getHours() + 1)
            const end = new Date(start.getTime() + 60 * 60000)
            return {
              ...d,
              events: [
                ...d.events,
                {
                  id, title: '', start: start.toISOString(), end: end.toISOString(),
                  allDay: false, recurrence: null, exdates: [], reminderMin: null,
                  taskId: null, color: 'cat-blue', notes: '',
                  ...patch,
                },
              ],
            }
          })
          return id
        },

        updateEvent: (id, patch) =>
          mutate((d) => ({ ...d, events: d.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

        deleteEvent: (id) => mutate((d) => ({ ...d, events: d.events.filter((e) => e.id !== id) })),

        excludeOccurrence: (eventId, occStartISO) =>
          mutate((d) => ({
            ...d,
            events: d.events.map((e) =>
              e.id === eventId && !e.exdates.includes(occStartISO)
                ? { ...e, exdates: [...e.exdates, occStartISO] }
                : e),
          })),

        scheduleTaskBlock: (taskId, start) => {
          const { data } = get()
          const task = data.tasks.find((t) => t.id === taskId)
          if (!task) return null
          const id = uid()
          const durMin = task.estimateMin && task.estimateMin > 0 ? task.estimateMin : 60
          mutate((d) => ({
            ...d,
            events: [
              ...d.events,
              {
                id,
                title: '', // le titre affiché est dérivé de la tâche (§7.2)
                start: start.toISOString(),
                end: new Date(start.getTime() + durMin * 60000).toISOString(),
                allDay: false, recurrence: null, exdates: [], reminderMin: null,
                taskId, color: 'cat-teal', notes: '',
              },
            ],
          }))
          return id
        },

        applyPlan: (placements) =>
          mutate((d) => ({
            ...d,
            events: [
              ...d.events,
              ...placements.map((p) => ({
                id: uid(), title: '',
                start: p.start.toISOString(), end: p.end.toISOString(),
                allDay: false, recurrence: null, exdates: [] as string[], reminderMin: null,
                taskId: p.taskId, color: 'cat-teal', notes: p.reasons.join(' · '),
              })),
            ],
          })),

        createHabit: (patch = {}) => {
          const id = uid()
          mutate((d) => ({
            ...d,
            habits: [
              ...d.habits,
              {
                id, name: '', color: 'cat-teal', frequency: 'daily' as const,
                timesPerWeek: 3, completions: [], createdAt: now(), archived: false,
                ...patch,
              },
            ],
          }))
          return id
        },

        updateHabit: (id, patch) =>
          mutate((d) => ({ ...d, habits: d.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) })),

        deleteHabit: (id) => mutate((d) => ({ ...d, habits: d.habits.filter((h) => h.id !== id) })),

        toggleHabitDay: (id, dateKey) =>
          mutate((d) => ({
            ...d,
            habits: d.habits.map((h) => {
              if (h.id !== id) return h
              const has = h.completions.includes(dateKey)
              return {
                ...h,
                completions: has ? h.completions.filter((c) => c !== dateKey) : [...h.completions, dateKey],
              }
            }),
          })),

        startTimer: (taskId) =>
          mutate((d) => ({
            ...d,
            sessions: [
              // Ferme toute session encore ouverte (un seul chrono à la fois)
              ...d.sessions.map((s) => (s.end == null ? { ...s, end: now() } : s)),
              { id: uid(), taskId, start: now(), end: null },
            ],
          })),

        stopTimer: () =>
          mutate((d) =>
            d.sessions.some((s) => s.end == null)
              ? { ...d, sessions: d.sessions.map((s) => (s.end == null ? { ...s, end: now() } : s)) }
              : d
          ),

        updateSchema: (dbId, fn) =>
          mutatePage(dbId, (p) => (p.schema ? { ...p, schema: fn(p.schema) } : p)),

        addProperty: (dbId, prop) =>
          get().updateSchema(dbId, (s) => ({ ...s, properties: [...s.properties, prop] })),

        updateProperty: (dbId, propId, patch) =>
          get().updateSchema(dbId, (s) => ({
            ...s,
            properties: s.properties.map((p) => (p.id === propId ? { ...p, ...patch } : p)),
          })),

        removeProperty: (dbId, propId) =>
          get().updateSchema(dbId, (s) => ({
            ...s,
            properties: s.properties.filter((p) => p.id !== propId),
            views: s.views.map((v) => ({
              ...v,
              filters: v.filters.filter((f) => f.propId !== propId),
              sorts: v.sorts.filter((so) => so.propId !== propId),
              groupBy: v.groupBy === propId ? undefined : v.groupBy,
            })),
          })),

        addView: (dbId, view) =>
          get().updateSchema(dbId, (s) => ({ ...s, views: [...s.views, view] })),

        updateView: (dbId, viewId, patch) =>
          get().updateSchema(dbId, (s) => ({
            ...s,
            views: s.views.map((v) => (v.id === viewId ? { ...v, ...patch } : v)),
          })),

        removeView: (dbId, viewId) =>
          get().updateSchema(dbId, (s) =>
            s.views.length > 1 ? { ...s, views: s.views.filter((v) => v.id !== viewId) } : s
          ),

        snapshotVersion: (pageId) => {
          const { data } = get()
          const page = findPage(data.pages, pageId)
          if (!page) return
          const history = data.versions[pageId] ?? []
          const next = recordVersion(history, page, now())
          if (next === history) return
          // Les snapshots de version ne passent pas par l'undo (métadonnée d'historique)
          set({ data: { ...data, versions: { ...data.versions, [pageId]: next } } })
        },

        restoreVersion: (pageId, versionId) => {
          const { data } = get()
          const v = (data.versions[pageId] ?? []).find((x) => x.id === versionId)
          if (!v) return
          // Snapshot de l'état courant avant restauration, pour ne rien perdre
          get().snapshotVersion(pageId)
          mutatePage(pageId, (p) => ({
            ...p,
            title: v.title,
            blocks: JSON.parse(JSON.stringify(v.blocks)) as Block[],
          }))
        },

        replaceData: (data) => {
          mutate(() => normalizeWorkspace(data))
        },

        undo: () => {
          const { undoStacks, data } = get()
          const r = undoOp(undoStacks, data)
          if (r) set({ data: r.state, undoStacks: r.stacks })
        },

        redo: () => {
          const { undoStacks, data } = get()
          const r = redoOp(undoStacks, data)
          if (r) set({ data: r.state, undoStacks: r.stacks })
        },
      }
    },
    {
      name: getStoreKey(),
      // localStorage avec chiffrement optionnel par profil (§4)
      storage: createJSONStorage(() => secureStorage),
      partialize: (s) => ({
        data: s.data,
        currentPageId: s.currentPageId,
        expanded: s.expanded,
        activeView: s.activeView,
        section: s.section,
        selectedTaskId: s.selectedTaskId,
        selectedProjectId: s.selectedProjectId,
      }),
      // Normalise toute donnée persistée (version antérieure : notes seules)
      // → les nouvelles tranches reçoivent leurs défauts, sans migration.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StoreState>
        return {
          ...current,
          ...p,
          data: normalizeWorkspace(p.data),
        }
      },
    }
  )
)
