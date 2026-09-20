import type { StateStorage } from 'zustand/middleware'
import { moduleKV } from '@jarvis/data-layer/renderer'
import { decryptString, encryptString, isEncryptedBlob } from '../core/crypto'

/** Support physique : data-layer namespacée 'planning' (SQLite via le shell,
 *  repli localStorage quand le module tourne isolément). */
const kv = moduleKV('planning')

/**
 * Stockage localStorage avec chiffrement optionnel (§4).
 * - Profil non chiffré : lecture/écriture en clair, comme avant.
 * - Profil chiffré : `getItem` attend que l'écran de déverrouillage
 *   fournisse la clé de session (dérivée du mot de passe), puis déchiffre ;
 *   `setItem` chiffre systématiquement dès qu'une clé est active.
 * Une donnée illisible (mauvaise clé, blob corrompu) rend `null` :
 * zustand repart des défauts — dégradation, jamais de crash.
 */

let sessionKey: CryptoKey | null = null
let resolveKey: ((k: CryptoKey) => void) | null = null
const keyPromise: Promise<CryptoKey> = new Promise((res) => { resolveKey = res })

export function provideSessionKey(key: CryptoKey): void {
  sessionKey = key
  resolveKey?.(key)
}

export function hasSessionKey(): boolean {
  return sessionKey !== null
}

/** Coupe le chiffrement des écritures (après désactivation dans les réglages). */
export function clearSessionKey(): void {
  sessionKey = null
}

export const secureStorage: StateStorage = {
  getItem: async (name) => {
    const raw = kv.getItem(name)
    if (raw === null) return null
    if (!isEncryptedBlob(raw)) return raw
    const key = await keyPromise
    return decryptString(raw, key)
  },
  setItem: async (name, value) => {
    if (sessionKey) kv.setItem(name, await encryptString(value, sessionKey))
    else kv.setItem(name, value)
  },
  removeItem: (name) => kv.removeItem(name),
}

/** Chiffre sur place la valeur stockée (activation du chiffrement). */
export async function encryptStoredValue(name: string, key: CryptoKey): Promise<void> {
  const raw = kv.getItem(name)
  if (raw !== null && !isEncryptedBlob(raw)) {
    kv.setItem(name, await encryptString(raw, key))
  }
}

/** Déchiffre sur place la valeur stockée (désactivation du chiffrement). */
export async function decryptStoredValue(name: string, key: CryptoKey): Promise<boolean> {
  const raw = kv.getItem(name)
  if (raw === null || !isEncryptedBlob(raw)) return true
  const plain = await decryptString(raw, key)
  if (plain === null) return false
  kv.setItem(name, plain)
  return true
}
