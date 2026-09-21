import type { OutboxRecord } from '../data/workspaceRepository'
import { getSupabase } from './supabaseClient'
import { replaceDataUrls, type DecodedDataUrl } from './filePayload'

const BUCKET = 'planning-attachments'
const STORAGE_PREFIX = `storage://${BUCKET}/`
const resolvedSources = new Map<string, Promise<string>>()

function extensionFor(mimeType: string): string {
  const known: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
    'image/svg+xml': 'svg', 'application/pdf': 'pdf', 'text/plain': 'txt',
  }
  return known[mimeType] ?? mimeType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') ?? 'bin'
}

async function digest(blob: Blob): Promise<string> {
  const bytes = await blob.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function prepareCloudPayload(record: OutboxRecord): Promise<unknown> {
  return replaceDataUrls(record.payload, async ({ blob, mimeType }: DecodedDataUrl) => {
    const hash = await digest(blob)
    const path = `${record.workspaceId}/files/${hash}.${extensionFor(mimeType)}`
    const { error } = await getSupabase().storage.from(BUCKET).upload(path, blob, {
      contentType: mimeType,
      upsert: true,
    })
    if (error) throw error
    return `${STORAGE_PREFIX}${path}`
  })
}

export function resolveCloudFileSource(source: string): Promise<string> {
  if (!source.startsWith(STORAGE_PREFIX)) return Promise.resolve(source)
  const cached = resolvedSources.get(source)
  if (cached) return cached

  const request = getSupabase().storage.from(BUCKET)
    .download(source.slice(STORAGE_PREFIX.length))
    .then(({ data, error }) => {
      if (error) throw error
      return URL.createObjectURL(data)
    })
  resolvedSources.set(source, request)
  request.catch(() => resolvedSources.delete(source))
  return request
}
