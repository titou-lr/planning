// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { deriveKey, isEncryptedBlob, makeSalt } from '../core/crypto'
import {
  clearSessionKey, decryptStoredValue, encryptStoredValue, provideSessionKey, secureStorage,
} from './secureStorage'

describe('stockage chiffré (§4) — câblage localStorage', () => {
  it('écrit en clair sans clé, chiffre après activation, relit après déverrouillage', async () => {
    // Sans clé : clair
    await secureStorage.setItem('k', '{"v":1}')
    expect(localStorage.getItem('k')).toBe('{"v":1}')
    expect(await secureStorage.getItem('k')).toBe('{"v":1}')

    // Activation : chiffrement sur place + écritures chiffrées
    const key = await deriveKey('pw', makeSalt())
    provideSessionKey(key)
    await encryptStoredValue('k', key)
    expect(isEncryptedBlob(localStorage.getItem('k') as string)).toBe(true)
    expect(await secureStorage.getItem('k')).toBe('{"v":1}')

    await secureStorage.setItem('k', '{"v":2}')
    expect(isEncryptedBlob(localStorage.getItem('k') as string)).toBe(true)
    expect(await secureStorage.getItem('k')).toBe('{"v":2}')

    // Désactivation : déchiffrement sur place, retour au clair
    expect(await decryptStoredValue('k', key)).toBe(true)
    clearSessionKey()
    expect(localStorage.getItem('k')).toBe('{"v":2}')
    await secureStorage.setItem('k', '{"v":3}')
    expect(localStorage.getItem('k')).toBe('{"v":3}')
  })

  it('refuse de déchiffrer sur place avec une mauvaise clé (aucune perte)', async () => {
    const good = await deriveKey('bon', makeSalt())
    provideSessionKey(good)
    await secureStorage.setItem('k2', 'secret')
    const bad = await deriveKey('mauvais', makeSalt())
    expect(await decryptStoredValue('k2', bad)).toBe(false)
    expect(isEncryptedBlob(localStorage.getItem('k2') as string)).toBe(true)
  })
})
