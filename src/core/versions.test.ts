import { describe, it, expect } from 'vitest'
import { recordVersion } from './versions'
import type { PageVersion } from './types'

const at = (min: number) => new Date(Date.UTC(2026, 0, 1, 10, min)).toISOString()

describe('versions', () => {
  it('empile une nouvelle version', () => {
    const h = recordVersion([], { title: 'A', blocks: [] }, at(0))
    expect(h).toHaveLength(1)
    expect(h[0].title).toBe('A')
  })

  it('ignore un contenu identique', () => {
    const h1 = recordVersion([], { title: 'A', blocks: [] }, at(0))
    const h2 = recordVersion(h1, { title: 'A', blocks: [] }, at(10))
    expect(h2).toBe(h1)
  })

  it('coalesce dans la fenêtre de 5 min, empile au-delà', () => {
    let h: PageVersion[] = recordVersion([], { title: 'v1', blocks: [] }, at(0))
    h = recordVersion(h, { title: 'v2', blocks: [] }, at(2)) // < 5 min → remplace
    expect(h).toHaveLength(1)
    expect(h[0].title).toBe('v2')
    h = recordVersion(h, { title: 'v3', blocks: [] }, at(20)) // > 5 min → empile
    expect(h).toHaveLength(2)
    expect(h.map((v) => v.title)).toEqual(['v2', 'v3'])
  })

  it('snapshot indépendant des blocs source (deep copy)', () => {
    const blocks = [{ id: 'b1', type: 'paragraph' as const, text: 'original' }]
    const h = recordVersion([], { title: 'A', blocks }, at(0))
    blocks[0].text = 'muté'
    expect(h[0].blocks[0].text).toBe('original')
  })
})
