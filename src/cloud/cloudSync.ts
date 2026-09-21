import type { RealtimeChannel, Session } from '@supabase/supabase-js'
import type { Json } from '../data/supabase.types'
import type { Profile } from '../store/profileService'
import { EMPTY_WORKSPACE } from '../core/types'
import { useStore } from '../store/useStore'
import {
  applyRemoteWorkspace,
  applyRemoteWorkspaceTransform,
  flushWorkspacePersistence,
  getWorkspaceRepository,
  setWorkspaceSyncContext,
} from '../store/workspacePersistence'
import { applyRemoteMutations, type RemoteMutation } from './syncProtocol'
import { prepareCloudPayload } from './cloudFiles'
import { replaceFileSources } from './filePayload'
import { cloudConfigured, getSupabase } from './supabaseClient'
import { initialCloudState, useCloudSync, type CloudState } from './cloudState'

let profile: Profile | null = null
let session: Session | null = null
let channel: RealtimeChannel | null = null
let initialized = false
let syncPromise: Promise<void> | null = null
let connectPromise: Promise<void> | null = null
let connectedUserId: string | null = null

function update(patch: Partial<CloudState>): void {
  useCloudSync.setState(patch)
}

function getDeviceId(): string {
  const key = 'planning-cloud-device-id'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const created = crypto.randomUUID()
  localStorage.setItem(key, created)
  return created
}

async function disconnectRuntime(): Promise<void> {
  setWorkspaceSyncContext(null)
  if (channel && cloudConfigured) await getSupabase().removeChannel(channel)
  channel = null
  connectedUserId = null
}

async function ensureWorkspace(userId: string): Promise<string> {
  const supabase = getSupabase()
  const { data: existing, error: selectError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (selectError) throw selectError
  if (existing) return existing.id

  const workspaceId = crypto.randomUUID()
  const { error: workspaceError } = await supabase.from('workspaces').insert({
    id: workspaceId,
    owner_id: userId,
    name: profile?.name ?? 'Espace principal',
  })
  if (workspaceError) throw workspaceError
  const { error: memberError } = await supabase.from('workspace_members').insert({
    workspace_id: workspaceId,
    user_id: userId,
    role: 'owner',
  })
  if (memberError) throw memberError
  return workspaceId
}

async function pull(workspaceId: string): Promise<void> {
  const repository = getWorkspaceRepository()
  let cursor = Number((await repository.getSyncState(workspaceId))?.cursor ?? 0)
  while (true) {
    const { data, error } = await getSupabase()
      .from('sync_mutations')
      .select('sequence,mutation_id,entity_type,entity_id,operation,payload')
      .eq('workspace_id', workspaceId)
      .gt('sequence', cursor)
      .order('sequence', { ascending: true })
      .limit(500)
    if (error) throw error
    if (!data?.length) break
    const mutations = data as RemoteMutation[]
    const base = cursor === 0 ? EMPTY_WORKSPACE : useStore.getState().data
    const next = applyRemoteMutations(base, mutations)
    await applyRemoteWorkspace(next)
    cursor = mutations[mutations.length - 1].sequence
    await repository.putSyncState({
      workspaceId,
      cursor: String(cursor),
      lastPulledAt: new Date().toISOString(),
    })
    if (mutations.length < 500) break
  }
}

async function push(workspaceId: string): Promise<void> {
  const repository = getWorkspaceRepository()
  while (true) {
    const batch = await repository.listOutbox(workspaceId, 200)
    update({ pending: batch.length })
    if (!batch.length) break
    const prepared = await Promise.all(batch.map(prepareCloudPayload))
    const replacements = new Map(prepared.flatMap(({ replacements: values }) => values))
    if (replacements.size) {
      await applyRemoteWorkspaceTransform((current) => replaceFileSources(current, replacements) as typeof current)
    }
    const rows = batch.map((record, index) => ({
      mutation_id: record.mutationId,
      workspace_id: record.workspaceId,
      device_id: record.deviceId,
      entity_type: record.entityType,
      entity_id: record.entityId,
      operation: record.operation,
      base_revision: record.baseRevision,
      payload: prepared[index].payload as Json,
    }))
    const { error } = await getSupabase()
      .from('sync_mutations')
      .upsert(rows, { onConflict: 'mutation_id', ignoreDuplicates: true })
    if (error) {
      await repository.markOutboxAttempt(batch.map(({ mutationId }) => mutationId))
      throw error
    }
    await repository.removeOutbox(batch.map(({ mutationId }) => mutationId))
  }
}

export function syncNow(): Promise<void> {
  if (syncPromise) return syncPromise
  syncPromise = (async () => {
    const workspaceId = useCloudSync.getState().workspaceId
    if (!workspaceId || !session) return
    if (!navigator.onLine) {
      update({ status: 'offline' })
      return
    }
    update({ status: 'syncing', error: null })
    await flushWorkspacePersistence()
    await push(workspaceId)
    await pull(workspaceId)
    update({ status: 'synced', pending: 0, lastSyncedAt: new Date().toISOString(), error: null })
  })().catch((error: unknown) => {
    update({ status: navigator.onLine ? 'error' : 'offline', error: error instanceof Error ? error.message : String(error) })
  }).finally(() => {
    syncPromise = null
  })
  return syncPromise
}

async function connectOnce(currentSession: Session): Promise<void> {
  session = currentSession
  update({ status: 'connecting', email: currentSession.user.email ?? null, error: null })
  const workspaceId = await ensureWorkspace(currentSession.user.id)
  const sync = { workspaceId, deviceId: getDeviceId() }
  setWorkspaceSyncContext(sync)
  update({ workspaceId })

  const repository = getWorkspaceRepository()
  const { count, error } = await getSupabase()
    .from('sync_mutations')
    .select('sequence', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  if (error) throw error
  if ((count ?? 0) === 0) await repository.enqueueSnapshot(useStore.getState().data, sync)

  if (channel) await getSupabase().removeChannel(channel)
  channel = getSupabase()
    .channel(`planning-sync-${workspaceId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'sync_mutations', filter: `workspace_id=eq.${workspaceId}`,
    }, () => { void syncNow() })
    .subscribe()

  await syncNow()
  connectedUserId = currentSession.user.id
}

function connect(currentSession: Session): Promise<void> {
  session = currentSession
  if (connectedUserId === currentSession.user.id && useCloudSync.getState().workspaceId) return syncNow()
  if (connectPromise) return connectPromise
  connectPromise = connectOnce(currentSession).finally(() => { connectPromise = null })
  return connectPromise
}

export async function initializeCloudSync(activeProfile: Profile): Promise<void> {
  profile = activeProfile
  if (!cloudConfigured || initialized) return
  initialized = true
  const supabase = getSupabase()
  supabase.auth.onAuthStateChange((_event, nextSession) => {
    window.setTimeout(() => {
      if (nextSession) void connect(nextSession).catch(handleError)
      else {
        session = null
        void disconnectRuntime()
        update({ ...initialCloudState, status: 'signed_out' })
      }
    }, 0)
  })
  window.addEventListener('online', () => { void syncNow() })
  window.addEventListener('offline', () => update({ status: 'offline' }))
  window.addEventListener('focus', () => { void syncNow() })
  window.addEventListener('planning:local-change', () => { void syncNow() })
  window.setInterval(() => { void syncNow() }, 30_000)

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (data.session) await connect(data.session)
}

function handleError(error: unknown): void {
  update({ status: 'error', error: error instanceof Error ? error.message : String(error) })
}

export async function sendMagicLink(email: string): Promise<void> {
  update({ status: 'connecting', error: null })
  const { error } = await getSupabase().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
  })
  if (error) return handleError(error)
  update({ status: 'awaiting_email', email })
}

export async function verifyEmailCode(email: string, token: string): Promise<void> {
  update({ status: 'connecting', error: null })
  const { error } = await getSupabase().auth.verifyOtp({ email, token, type: 'email' })
  if (error) handleError(error)
}

export async function signOutCloud(): Promise<void> {
  const { error } = await getSupabase().auth.signOut()
  if (error) handleError(error)
}
