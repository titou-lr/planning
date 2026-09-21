import { EMPTY_WORKSPACE, type PageVersion, type WorkspaceData } from '../core/types'
import { normalizeWorkspace } from '../core/workspace'
import type { OutboxRecord } from '../data/workspaceRepository'

export const SYNC_COLLECTIONS = {
  page: 'pages',
  task: 'tasks',
  task_status: 'statuses',
  label: 'labels',
  project: 'projects',
  cycle: 'cycles',
  goal: 'goals',
  saved_task_view: 'savedTaskViews',
  automation: 'automations',
  project_template: 'projectTemplates',
  task_field: 'taskFields',
  calendar_event: 'events',
  habit: 'habits',
  time_session: 'sessions',
} as const

export type SyncEntityType = keyof typeof SYNC_COLLECTIONS | 'page_version'

export interface RemoteMutation {
  sequence: number
  mutation_id: string
  entity_type: string
  entity_id: string
  operation: string
  payload: unknown
}

interface VersionPayload {
  pageId: string
  version: PageVersion
}

function mutation(
  workspaceId: string,
  deviceId: string,
  entityType: SyncEntityType,
  entityId: string,
  operation: OutboxRecord['operation'],
  payload: unknown,
): OutboxRecord {
  return {
    mutationId: crypto.randomUUID(),
    deviceId,
    workspaceId,
    entityType,
    entityId,
    operation,
    baseRevision: null,
    payload,
    createdAtLocal: new Date().toISOString(),
    attempts: 0,
  }
}

function diffRows<T extends { id: string }>(
  previous: T[],
  next: T[],
  entityType: SyncEntityType,
  workspaceId: string,
  deviceId: string,
): OutboxRecord[] {
  if (previous === next) return []
  const before = new Map(previous.map((row) => [row.id, row]))
  const after = new Map(next.map((row) => [row.id, row]))
  const records: OutboxRecord[] = []
  for (const row of next) {
    if (before.get(row.id) !== row) {
      records.push(mutation(workspaceId, deviceId, entityType, row.id, 'upsert', row))
    }
  }
  for (const row of previous) {
    if (!after.has(row.id)) records.push(mutation(workspaceId, deviceId, entityType, row.id, 'delete', null))
  }
  return records
}

function flattenVersions(data: WorkspaceData['versions']): Map<string, VersionPayload> {
  const rows = new Map<string, VersionPayload>()
  for (const [pageId, versions] of Object.entries(data)) {
    for (const version of versions) rows.set(`${pageId}:${version.id}`, { pageId, version })
  }
  return rows
}

export function buildOutbox(
  previous: WorkspaceData,
  next: WorkspaceData,
  workspaceId: string,
  deviceId: string,
): OutboxRecord[] {
  const records: OutboxRecord[] = []
  for (const [entityType, collection] of Object.entries(SYNC_COLLECTIONS) as [keyof typeof SYNC_COLLECTIONS, keyof WorkspaceData][]) {
    records.push(...diffRows(
      previous[collection] as { id: string }[],
      next[collection] as { id: string }[],
      entityType,
      workspaceId,
      deviceId,
    ))
  }

  if (previous.versions !== next.versions) {
    const before = flattenVersions(previous.versions)
    const after = flattenVersions(next.versions)
    for (const [id, payload] of after) {
      if (before.get(id)?.version !== payload.version) {
        records.push(mutation(workspaceId, deviceId, 'page_version', id, 'upsert', payload))
      }
    }
    for (const id of before.keys()) {
      if (!after.has(id)) records.push(mutation(workspaceId, deviceId, 'page_version', id, 'delete', null))
    }
  }
  return records
}

export function snapshotOutbox(data: WorkspaceData, workspaceId: string, deviceId: string): OutboxRecord[] {
  return buildOutbox(EMPTY_WORKSPACE, data, workspaceId, deviceId)
}

function applyCollectionMutation(
  data: WorkspaceData,
  entityType: keyof typeof SYNC_COLLECTIONS,
  entityId: string,
  operation: string,
  payload: unknown,
): WorkspaceData {
  const collection = SYNC_COLLECTIONS[entityType]
  const rows = data[collection] as { id: string }[]
  const index = rows.findIndex((row) => row.id === entityId)
  const nextRows = [...rows]
  if (operation === 'delete') {
    if (index >= 0) nextRows.splice(index, 1)
  } else if (payload && typeof payload === 'object') {
    const row = payload as { id: string }
    if (index >= 0) nextRows[index] = row
    else nextRows.push(row)
  }
  return { ...data, [collection]: nextRows }
}

export function applyRemoteMutations(data: WorkspaceData, mutations: RemoteMutation[]): WorkspaceData {
  let next = data
  for (const remote of [...mutations].sort((a, b) => a.sequence - b.sequence)) {
    if (remote.entity_type === 'page_version') {
      const separator = remote.entity_id.lastIndexOf(':')
      const pageId = separator >= 0 ? remote.entity_id.slice(0, separator) : ''
      const versionId = separator >= 0 ? remote.entity_id.slice(separator + 1) : remote.entity_id
      const history = [...(next.versions[pageId] ?? [])]
      const index = history.findIndex((version) => version.id === versionId)
      if (remote.operation === 'delete') {
        if (index >= 0) history.splice(index, 1)
      } else {
        const payload = remote.payload as VersionPayload | null
        if (!payload?.version) continue
        if (index >= 0) history[index] = payload.version
        else history.push(payload.version)
        history.sort((a, b) => a.at.localeCompare(b.at))
      }
      next = { ...next, versions: { ...next.versions, [pageId]: history } }
      continue
    }

    if (remote.entity_type in SYNC_COLLECTIONS) {
      next = applyCollectionMutation(
        next,
        remote.entity_type as keyof typeof SYNC_COLLECTIONS,
        remote.entity_id,
        remote.operation,
        remote.payload,
      )
    }
  }
  return normalizeWorkspace(next)
}
