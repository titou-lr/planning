// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { representativeWorkspace } from '../test/fixtures/workspace'
import { normalizeWorkspace } from '../core/workspace'
import { EMPTY_WORKSPACE } from '../core/types'
import { applyRemoteMutations, buildOutbox, snapshotOutbox, type RemoteMutation } from './syncProtocol'

describe('protocole de synchronisation', () => {
  it('produit des mutations incrémentales pour les modifications et suppressions', () => {
    const next = {
      ...representativeWorkspace,
      pages: representativeWorkspace.pages.map((page, index) => index === 0 ? { ...page, title: 'Modifiée' } : page),
      labels: representativeWorkspace.labels.slice(1),
    }
    const records = buildOutbox(representativeWorkspace, next, 'workspace', 'device')

    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: 'page', entityId: representativeWorkspace.pages[0].id, operation: 'upsert' }),
      expect.objectContaining({ entityType: 'label', entityId: representativeWorkspace.labels[0].id, operation: 'delete' }),
    ]))
    expect(records).toHaveLength(2)
  })

  it('reconstruit un workspace depuis un journal initial', () => {
    const records = snapshotOutbox(representativeWorkspace, 'workspace', 'device')
    const remote = records.map((record, index): RemoteMutation => ({
      sequence: index + 1,
      mutation_id: record.mutationId,
      entity_type: record.entityType,
      entity_id: record.entityId,
      operation: record.operation,
      payload: record.payload,
    }))

    expect(applyRemoteMutations(EMPTY_WORKSPACE, remote)).toEqual(representativeWorkspace)
  })

  it('fait converger les conflits vers la dernière séquence serveur', () => {
    const page = representativeWorkspace.pages[0]
    const mutations: RemoteMutation[] = [
      { sequence: 2, mutation_id: 'b', entity_type: 'page', entity_id: page.id, operation: 'upsert', payload: { ...page, title: 'Serveur 2' } },
      { sequence: 1, mutation_id: 'a', entity_type: 'page', entity_id: page.id, operation: 'upsert', payload: { ...page, title: 'Serveur 1' } },
    ]

    const result = applyRemoteMutations(normalizeWorkspace(undefined), mutations)
    expect(result.pages[0].title).toBe('Serveur 2')
  })
})
