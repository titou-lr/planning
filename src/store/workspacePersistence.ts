import { normalizeWorkspace } from '../core/workspace'
import { PlanningDatabase, WorkspaceRepository } from '../data/workspaceRepository'
import { getStoreKey } from './profileService'
import { secureStorage } from './secureStorage'
import { stopLegacyWorkspacePersistence, useStore } from './useStore'

let initialization: Promise<void> | null = null

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

    const repository = new WorkspaceRepository(new PlanningDatabase(`planning-${storeKey}`))
    const stored = await repository.load()
    if (stored) {
      useStore.setState({ data: normalizeWorkspace(stored) })
    } else {
      await repository.replaceAll(normalizeWorkspace(useStore.getState().data))
    }

    useStore.subscribe((state, previous) => {
      if (state.data === previous.data) return
      void repository.persistDiff(previous.data, state.data).catch((error: unknown) => {
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
