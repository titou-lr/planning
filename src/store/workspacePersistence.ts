import { normalizeWorkspace } from '../core/workspace'
import { PlanningDatabase, WorkspaceRepository, type SyncContext } from '../data/workspaceRepository'
import { getStoreKey } from './profileService'
import { secureStorage } from './secureStorage'
import { stopLegacyWorkspacePersistence, useStore } from './useStore'

let initialization: Promise<void> | null = null
let repository: WorkspaceRepository | null = null
let syncContext: SyncContext | null = null
let persistenceQueue = Promise.resolve()
let skipNextPersistence = false

export function setWorkspaceSyncContext(context: SyncContext | null): void {
  syncContext = context
}

export function getWorkspaceRepository(): WorkspaceRepository {
  if (!repository) throw new Error('La persistance locale n’est pas initialisée')
  return repository
}

export async function flushWorkspacePersistence(): Promise<void> {
  await persistenceQueue
}

export async function applyRemoteWorkspace(data: ReturnType<typeof normalizeWorkspace>): Promise<void> {
  await flushWorkspacePersistence()
  const next = normalizeWorkspace(data)
  const previous = useStore.getState().data
  if (previous === next) return
  await getWorkspaceRepository().persistDiff(previous, next, null)
  skipNextPersistence = true
  useStore.setState({ data: next })
}

async function waitForZustandHydration(): Promise<void> {
  if (useStore.persist.hasHydrated()) return
  await new Promise<void>((resolve) => {
    const unsubscribe = useStore.persist.onFinishHydration(() => {
      unsubscribe()
      resolve()
    })
    if (useStore.persist.hasHydrated()) {
      unsubscribe()
      resolve()
    }
  })
}

export function initializeWorkspacePersistence(): Promise<void> {
  if (initialization) return initialization
  initialization = (async () => {
    await waitForZustandHydration()

    const storeKey = getStoreKey()
    const legacyBackupKey = `${storeKey}-migration-backup-v1`
    const legacySnapshot = await secureStorage.getItem(storeKey)
    if (legacySnapshot && !(await secureStorage.getItem(legacyBackupKey))) {
      await secureStorage.setItem(legacyBackupKey, legacySnapshot)
    }

    repository = new WorkspaceRepository(new PlanningDatabase(`planning-${storeKey}`))
    const stored = await repository.load()
    if (stored) {
      useStore.setState({ data: normalizeWorkspace(stored) })
    } else {
      await repository.replaceAll(normalizeWorkspace(useStore.getState().data))
    }

    useStore.subscribe((state, previous) => {
      if (state.data === previous.data) return
      if (skipNextPersistence) {
        skipNextPersistence = false
        return
      }
      const currentContext = syncContext
      persistenceQueue = persistenceQueue.then(async () => {
        await repository!.persistDiff(previous.data, state.data, currentContext)
        if (currentContext && typeof window !== 'undefined') window.dispatchEvent(new Event('planning:local-change'))
      })
      void persistenceQueue.catch((error: unknown) => {
        console.error('IndexedDB persistence failed', error)
      })
    })

    stopLegacyWorkspacePersistence()
    await useStore.persist.clearStorage()
    const { section } = useStore.getState()
    useStore.setState({ section })
  })()
  return initialization
}
