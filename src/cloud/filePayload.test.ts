import { describe, expect, it, vi } from 'vitest'
import { decodeDataUrl, replaceDataUrls, replaceFileSources } from './filePayload'

describe('cloud file payloads', () => {
  it('decodes base64 and percent-encoded data URLs', async () => {
    const base64 = decodeDataUrl('data:text/plain;base64,b2s=')
    const encoded = decodeDataUrl('data:text/plain,bonjour%20mobile')
    expect(base64?.mimeType).toBe('text/plain')
    expect(await base64?.blob.text()).toBe('ok')
    expect(await encoded?.blob.text()).toBe('bonjour mobile')
  })

  it('replaces nested file sources without touching ordinary URLs', async () => {
    const upload = vi.fn(async () => 'storage://planning-attachments/workspace/files/hash.png')
    const payload = {
      blocks: [{ src: 'data:image/png;base64,iVBORw0KGgo=' }, { src: 'https://example.com/image.png' }],
      attachments: [{ src: 'data:text/plain;base64,b2s=' }],
    }
    const result = await replaceDataUrls(payload, upload)
    expect(upload).toHaveBeenCalledTimes(2)
    expect(result).toEqual({
      blocks: [{ src: 'storage://planning-attachments/workspace/files/hash.png' }, { src: 'https://example.com/image.png' }],
      attachments: [{ src: 'storage://planning-attachments/workspace/files/hash.png' }],
    })
    expect(payload.blocks[0].src).toMatch(/^data:/)
  })

  it('remplace ensuite les data URLs locales par les références Storage reçues', () => {
    const source = 'data:text/plain;base64,b2s='
    const stored = 'storage://planning-attachments/workspace/files/hash.txt'
    const payload = { attachments: [{ id: 'a', src: source }], title: 'inchangé' }
    const result = replaceFileSources(payload, new Map([[source, stored]]))
    expect(result).toEqual({ attachments: [{ id: 'a', src: stored }], title: 'inchangé' })
    expect(payload.attachments[0].src).toBe(source)
    expect(replaceFileSources(payload, new Map())).toBe(payload)
  })
})
