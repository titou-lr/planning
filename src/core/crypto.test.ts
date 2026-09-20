import { describe, expect, it } from 'vitest'
import { CHECK_PLAINTEXT, decryptString, deriveKey, encryptString, isEncryptedBlob, makeSalt } from './crypto'

describe('chiffrement optionnel (§4)', () => {
  it('chiffre et déchiffre en aller-retour', async () => {
    const salt = makeSalt()
    const key = await deriveKey('mot-de-passe', salt)
    const blob = await encryptString('{"data":"secret été 🎉"}', key)
    expect(isEncryptedBlob(blob)).toBe(true)
    expect(blob).not.toContain('secret')
    expect(await decryptString(blob, key)).toBe('{"data":"secret été 🎉"}')
  })

  it('rend null avec un mauvais mot de passe (jamais d’exception)', async () => {
    const salt = makeSalt()
    const good = await deriveKey('bon', salt)
    const bad = await deriveKey('mauvais', salt)
    const blob = await encryptString(CHECK_PLAINTEXT, good)
    expect(await decryptString(blob, bad)).toBeNull()
  })

  it('rend null sur un blob corrompu', async () => {
    const key = await deriveKey('x', makeSalt())
    expect(await decryptString('encv1:!!!:???', key)).toBeNull()
  })

  it('laisse passer les chaînes non chiffrées telles quelles', async () => {
    const key = await deriveKey('x', makeSalt())
    expect(await decryptString('{"plain":true}', key)).toBe('{"plain":true}')
  })
})
