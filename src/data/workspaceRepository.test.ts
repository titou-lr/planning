// @vitest-environment node
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { makeLargeWorkspace, representativeWorkspace } from '../test/fixtures/workspace'
import { PlanningDatabase, WorkspaceRepository } from './workspaceRepository'

const databases: PlanningDatabase[] = []

function createRepository() {
  const db = new PlanningDatabase(`planning-test-${crypto.randomUUID()}`)
  databases.push(db)
  return new WorkspaceRepository(db)
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (db) => {
    db.close()
    await DexieDelete(db.name)
  }))
})

function DexieDelete(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error(`Suppression bloquée pour ${name}`))
  })
}

describe('WorkspaceRepository IndexedDB', () => {
  it('migre puis recharge toutes les familles de données', async () => {
    const repository = createRepository()
    expect(await repository.load()).toBeNull()

    await repository.replaceAll(representativeWorkspace)

    expect(await repository.load()).toEqual(representativeWorkspace)
  })

  it('persiste uniquement les entités modifiées ou supprimées', async () => {
    const repository = createRepository()
    await repository.replaceAll(representativeWorkspace)
    const next = {
      ...representativeWorkspace,
      pages: [],
      tasks: representativeWorkspace.tasks.map((task) => ({ ...task, title: 'Titre modifié' })),
    }

    await repository.persistDiff(representativeWorkspace, next)

    expect(await repository.load()).toEqual(next)
  })

  it('restaure un volume de 5 000 pages et 5 000 tâches', async () => {
    const repository = createRepository()
    const large = makeLargeWorkspace()

    await repository.replaceAll(large)
    const restored = await repository.load()

    expect(restored?.pages).toHaveLength(5_000)
    expect(restored?.tasks).toHaveLength(5_000)
  })

  it('prépare les tables de synchronisation et de blobs', async () => {
    const repository = createRepository()
    await repository.db.open()

    expect(repository.db.tables.map((table) => table.name)).toEqual(expect.arrayContaining([
      'outbox', 'syncState', 'blobs',
    ]))
  })
})
