const DATA_URL = /^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,([\s\S]*)$/

export interface DecodedDataUrl {
  blob: Blob
  mimeType: string
}

export function decodeDataUrl(source: string): DecodedDataUrl | null {
  const match = DATA_URL.exec(source)
  if (!match) return null
  const mimeType = match[1] || 'application/octet-stream'
  try {
    const value = match[2]
      ? atob(match[3])
      : decodeURIComponent(match[3].replace(/\+/g, '%20'))
    const bytes = Uint8Array.from(value, (character) => character.charCodeAt(0))
    return { blob: new Blob([bytes], { type: mimeType }), mimeType }
  } catch {
    return null
  }
}

export async function replaceDataUrls(
  value: unknown,
  upload: (decoded: DecodedDataUrl, source: string) => Promise<string>,
): Promise<unknown> {
  if (Array.isArray(value)) return Promise.all(value.map((item) => replaceDataUrls(item, upload)))
  if (!value || typeof value !== 'object') return value

  const next: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === 'src' && typeof child === 'string' && child.startsWith('data:')) {
      const decoded = decodeDataUrl(child)
      next[key] = decoded ? await upload(decoded, child) : child
    } else {
      next[key] = await replaceDataUrls(child, upload)
    }
  }
  return next
}

export function replaceFileSources(value: unknown, replacements: ReadonlyMap<string, string>): unknown {
  if (Array.isArray(value)) {
    let changed = false
    const next = value.map((item) => {
      const replaced = replaceFileSources(item, replacements)
      changed ||= replaced !== item
      return replaced
    })
    return changed ? next : value
  }
  if (!value || typeof value !== 'object') return value

  let changed = false
  const next: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    const replaced = key === 'src' && typeof child === 'string'
      ? (replacements.get(child) ?? child)
      : replaceFileSources(child, replacements)
    changed ||= replaced !== child
    next[key] = replaced
  }
  return changed ? next : value
}
