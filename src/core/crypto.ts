/**
 * Chiffrement optionnel des données locales (CLAUDE.md §4) —
 * AES-GCM 256 via WebCrypto, clé dérivée du mot de passe (PBKDF2).
 * Pur (aucune dépendance UI/stockage) ; le mot de passe ne quitte
 * jamais la machine et n'est jamais stocké : en cas d'oubli, les
 * données sont irrécupérables (avertissement affiché dans l'UI).
 */

const PREFIX = 'encv1:'
const ITERATIONS = 210_000
/** Valeur connue chiffrée au moment de l'activation, pour vérifier le mot de passe. */
export const CHECK_PLAINTEXT = 'suite-locale-check'

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function makeSalt(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(16)))
}

export async function deriveKey(password: string, saltB64: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64) as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export function isEncryptedBlob(s: string): boolean {
  return s.startsWith(PREFIX)
}

export async function encryptString(plain: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(plain)
  )
  return `${PREFIX}${toB64(iv)}:${toB64(cipher)}`
}

/** Null si le blob est invalide ou la clé mauvaise (jamais d'exception). */
export async function decryptString(blob: string, key: CryptoKey): Promise<string | null> {
  if (!isEncryptedBlob(blob)) return blob
  try {
    const [ivB64, dataB64] = blob.slice(PREFIX.length).split(':')
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(ivB64) as BufferSource }, key, fromB64(dataB64) as BufferSource
    )
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}
