import Dexie, { type Table } from 'dexie'
import type {
  AutomationRule, CalendarEvent, Cycle, Goal, Habit, Label, Page, PageVersion,
  Project, ProjectTemplate, PropertyDef, SavedTaskView, Task, TaskStatus, TimeSession,
  WorkspaceData,
} from '../core/types'
import { normalizeWorkspace } from '../core/workspace'

interface VersionRecord extends PageVersion {
  key: string
  pageId: string
}

interface WorkspaceMeta {
  key: 'workspace'
  schemaVersion: number
  migratedAt: string
  updatedAt: string
  orders: Record<string, string[]>
}

export interface OutboxRecord {
  mutationId: string
  deviceId: string
  workspaceId: string
  entityType: string
  entityId: string
  operation: 'upsert' | 'delete'
  baseRevision: number | null
  payload: unknown
  createdAtLocal: string
  attempts: number
}

export interface SyncStateRecord {
  workspaceId: string
  cursor: string | null
  lastPulledAt: string | null
}

export interface LocalBlobRecord {
  id: string
  entityId: string
  mimeType: string
  blob: Blob
  updatedAt: string
}

export class PlanningDatabase extends Dexie {
  pages!: Table<Page, string>
  versions!: Table<VersionRecord, string>
  tasks!: Table<Task, string>
  statuses!: Table<TaskStatus, string>
  labels!: Table<Label, string>
  projects!: Table<Project, string>
  cycles!: Table<Cycle, string>
  goals!: Table<Goal, string>
  savedTaskViews!: Table<SavedTaskView, string>
  automations!: Table<AutomationRule, string>
  projectTemplates!: Table<ProjectTemplate, string>
  taskFields!: Table<PropertyDef, string>
  events!: Table<CalendarEvent, string>
  habits!: Table<Habit, string>
  sessions!: Table<TimeSession, string>
  meta!: Table<WorkspaceMeta, string>
  outbox!: Table<OutboxRecord, string>
  syncState!: Table<SyncStateRecord, string>
  blobs!: Table<LocalBlobRecord, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      pages: 'id,parentId,updatedAt',
      versions: 'key,pageId,at',
      tasks: 'id,statusId,projectId,cycleId,dueDate,updatedAt',
      statuses: 'id,order,category',
      labels: 'id,name',
      projects: 'id,order,targetDate',
      cycles: 'id,startDate,endDate',
      goals: 'id,targetDate',
      savedTaskViews: 'id,name',
      automations: 'id,enabled,trigger',
      projectTemplates: 'id,name',
      taskFields: 'id,name,type',
      events: 'id,start,end,taskId',
      habits: 'id,archived',
      sessions: 'id,taskId,start,end',
      meta: 'key',
      outbox: 'mutationId,workspaceId,[entityType+entityId],createdAtLocal',
      syncState: 'workspaceId',
      blobs: 'id,entityId,updatedAt',
    })
  }
}

function flattenVersions(versions: WorkspaceData['versions']): VersionRecord[] {
  return Object.entries(versions).flatMap(([pageId, history]) =>
    history.map((version) => ({ ...version, pageId, key: `${pageId}:${version.id}` })))
}

function groupVersions(records: VersionRecord[]): WorkspaceData['versions'] {
  const versions: WorkspaceData['versions'] = {}
  for (const { key: _key, pageId, ...version } of records) {
    ;(versions[pageId] ??= []).push(version)
  }
  for (const history of Object.values(versions)) history.sort((a, b) => a.at.localeCompare(b.at))
  return versions
}

function workspaceOrders(data: WorkspaceData): Record<string, string[]> {
  return {
    pages: data.pages.map(({ id }) => id), tasks: data.tasks.map(({ id }) => id),
    statuses: data.statuses.map(({ id }) => id), labels: data.labels.map(({ id }) => id),
    projects: data.projects.map(({ id }) => id), cycles: data.cycles.map(({ id }) => id),
    goals: data.goals.map(({ id }) => id), savedTaskViews: data.savedTaskViews.map(({ id }) => id),
    automations: data.automations.map(({ id }) => id),
    projectTemplates: data.projectTemplates.map(({ id }) => id), taskFields: data.taskFields.map(({ id }) => id),
    events: data.events.map(({ id }) => id), habits: data.habits.map(({ id }) => id),
    sessions: data.sessions.map(({ id }) => id),
  }
}

function restoreOrder<T extends { id: string }>(rows: T[], ids: string[] | undefined): T[] {
  if (!ids?.length) return rows
  const position = new Map(ids.map((id, index) => [id, index]))
  return [...rows].sort((a, b) => (position.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.id) ?? Number.MAX_SAFE_INTEGER))
}

async function replaceTable<T extends { id: string }>(table: Table<T, string>, rows: T[]): Promise<void> {
  await table.clear()
  if (rows.length) await table.bulkPut(rows)
}

async function persistEntityDiff<T extends { id: string }>(
  table: Table<T, string>,
  previous: T[],
  next: T[],
): Promise<void> {
  if (previous === next) return
  const previousById = new Map(previous.map((row) => [row.id, row]))
  const nextIds = new Set(next.map((row) => row.id))
  const changed = next.filter((row) => previousById.get(row.id) !== row)
  const removed = previous.filter((row) => !nextIds.has(row.id)).map((row) => row.id)
  if (changed.length) await table.bulkPut(changed)
  if (removed.length) await table.bulkDelete(removed)
}

export class WorkspaceRepository {
  constructor(readonly db: PlanningDatabase) {}

  async load(): Promise<WorkspaceData | null> {
    const meta = await this.db.meta.get('workspace')
    if (!meta) return null
    const orders = meta.orders ?? {}
    const [
      pages, versionRows, tasks, statuses, labels, projects, cycles, goals,
      savedTaskViews, automations, projectTemplates, taskFields, events, habits, sessions,
    ] = await Promise.all([
      this.db.pages.toArray(), this.db.versions.toArray(), this.db.tasks.toArray(),
      this.db.statuses.toArray(), this.db.labels.toArray(), this.db.projects.toArray(),
      this.db.cycles.toArray(), this.db.goals.toArray(), this.db.savedTaskViews.toArray(),
      this.db.automations.toArray(), this.db.projectTemplates.toArray(), this.db.taskFields.toArray(),
      this.db.events.toArray(), this.db.habits.toArray(), this.db.sessions.toArray(),
    ])
    return normalizeWorkspace({
      pages: restoreOrder(pages, orders.pages), versions: groupVersions(versionRows),
      tasks: restoreOrder(tasks, orders.tasks), statuses: restoreOrder(statuses, orders.statuses),
      labels: restoreOrder(labels, orders.labels), projects: restoreOrder(projects, orders.projects),
      cycles: restoreOrder(cycles, orders.cycles), goals: restoreOrder(goals, orders.goals),
      savedTaskViews: restoreOrder(savedTaskViews, orders.savedTaskViews),
      automations: restoreOrder(automations, orders.automations),
      projectTemplates: restoreOrder(projectTemplates, orders.projectTemplates),
      taskFields: restoreOrder(taskFields, orders.taskFields),
      events: restoreOrder(events, orders.events), habits: restoreOrder(habits, orders.habits),
      sessions: restoreOrder(sessions, orders.sessions),
    })
  }

  async replaceAll(data: WorkspaceData): Promise<void> {
    const now = new Date().toISOString()
    await this.db.transaction('rw', [
      this.db.pages, this.db.versions, this.db.tasks, this.db.statuses, this.db.labels,
      this.db.projects, this.db.cycles, this.db.goals, this.db.savedTaskViews,
      this.db.automations, this.db.projectTemplates, this.db.taskFields, this.db.events,
      this.db.habits, this.db.sessions, this.db.meta,
    ], async () => {
      await Promise.all([
        replaceTable(this.db.pages, data.pages),
        replaceTable(this.db.tasks, data.tasks),
        replaceTable(this.db.statuses, data.statuses),
        replaceTable(this.db.labels, data.labels),
        replaceTable(this.db.projects, data.projects),
        replaceTable(this.db.cycles, data.cycles),
        replaceTable(this.db.goals, data.goals),
        replaceTable(this.db.savedTaskViews, data.savedTaskViews),
        replaceTable(this.db.automations, data.automations),
        replaceTable(this.db.projectTemplates, data.projectTemplates),
        replaceTable(this.db.taskFields, data.taskFields),
        replaceTable(this.db.events, data.events),
        replaceTable(this.db.habits, data.habits),
        replaceTable(this.db.sessions, data.sessions),
        this.db.versions.clear().then(() => {
          const rows = flattenVersions(data.versions)
          return rows.length ? this.db.versions.bulkPut(rows).then(() => undefined) : undefined
        }),
      ])
      await this.db.meta.put({
        key: 'workspace', schemaVersion: 1, migratedAt: now, updatedAt: now,
        orders: workspaceOrders(data),
      })
    })
  }

  async persistDiff(previous: WorkspaceData, next: WorkspaceData): Promise<void> {
    if (previous === next) return
    await this.db.transaction('rw', [
      this.db.pages, this.db.versions, this.db.tasks, this.db.statuses, this.db.labels,
      this.db.projects, this.db.cycles, this.db.goals, this.db.savedTaskViews,
      this.db.automations, this.db.projectTemplates, this.db.taskFields, this.db.events,
      this.db.habits, this.db.sessions, this.db.meta,
    ], async () => {
      await Promise.all([
        persistEntityDiff(this.db.pages, previous.pages, next.pages),
        persistEntityDiff(this.db.tasks, previous.tasks, next.tasks),
        persistEntityDiff(this.db.statuses, previous.statuses, next.statuses),
        persistEntityDiff(this.db.labels, previous.labels, next.labels),
        persistEntityDiff(this.db.projects, previous.projects, next.projects),
        persistEntityDiff(this.db.cycles, previous.cycles, next.cycles),
        persistEntityDiff(this.db.goals, previous.goals, next.goals),
        persistEntityDiff(this.db.savedTaskViews, previous.savedTaskViews, next.savedTaskViews),
        persistEntityDiff(this.db.automations, previous.automations, next.automations),
        persistEntityDiff(this.db.projectTemplates, previous.projectTemplates, next.projectTemplates),
        persistEntityDiff(this.db.taskFields, previous.taskFields, next.taskFields),
        persistEntityDiff(this.db.events, previous.events, next.events),
        persistEntityDiff(this.db.habits, previous.habits, next.habits),
        persistEntityDiff(this.db.sessions, previous.sessions, next.sessions),
      ])
      if (previous.versions !== next.versions) {
        const pageIds = new Set([...Object.keys(previous.versions), ...Object.keys(next.versions)])
        for (const pageId of pageIds) {
          if (previous.versions[pageId] === next.versions[pageId]) continue
          await this.db.versions.where('pageId').equals(pageId).delete()
          const rows = flattenVersions({ [pageId]: next.versions[pageId] ?? [] })
          if (rows.length) await this.db.versions.bulkPut(rows)
        }
      }
      const meta = await this.db.meta.get('workspace')
      await this.db.meta.put({
        key: 'workspace', schemaVersion: 1,
        migratedAt: meta?.migratedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        orders: workspaceOrders(next),
      })
    })
  }
}
