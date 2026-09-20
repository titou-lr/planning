import { describe, expect, it } from 'vitest'
import { buildShellDefaultProfile, resolveShellProfile, type Profile } from './profileService'

function profile(id: string, lastOpenedAt: string): Profile {
  return { id, name: id, avatar: '🗂️', createdAt: '2026-01-01T00:00:00Z', lastOpenedAt }
}

describe('resolveShellProfile (unification compte shell ↔ profil)', () => {
  it('crée un profil quand le module est vierge', () => {
    expect(resolveShellProfile([], null)).toEqual({ kind: 'create' })
  })

  it('réutilise le profil mémorisé pour ce compte s’il existe encore', () => {
    const profiles = [profile('a', '2026-01-02T00:00:00Z'), profile('b', '2026-05-01T00:00:00Z')]
    expect(resolveShellProfile(profiles, 'a')).toEqual({ kind: 'use', id: 'a' })
  })

  it('ignore un profil mémorisé supprimé et retombe sur le plus récent', () => {
    const profiles = [profile('a', '2026-01-02T00:00:00Z'), profile('b', '2026-05-01T00:00:00Z')]
    expect(resolveShellProfile(profiles, 'supprimé')).toEqual({ kind: 'use', id: 'b' })
  })

  it('sans mémorisation, mappe vers le profil le plus récemment ouvert (multi-profils préexistants)', () => {
    const profiles = [
      profile('vieux', '2025-11-01T00:00:00Z'),
      profile('récent', '2026-06-01T00:00:00Z'),
      profile('moyen', '2026-03-01T00:00:00Z'),
    ]
    expect(resolveShellProfile(profiles, null)).toEqual({ kind: 'use', id: 'récent' })
  })
})

describe('buildShellDefaultProfile', () => {
  it('dérive nom et avatar du compte shell', () => {
    const p = buildShellDefaultProfile({ accountName: 'Antoine', accountAvatar: '🚀' }, '2026-07-18T00:00:00Z', 'fixed-id')
    expect(p).toEqual({
      id: 'fixed-id',
      name: 'Antoine',
      avatar: '🚀',
      createdAt: '2026-07-18T00:00:00Z',
      lastOpenedAt: '2026-07-18T00:00:00Z',
    })
  })

  it('a des valeurs de repli si le compte n’expose pas nom/avatar', () => {
    const p = buildShellDefaultProfile({}, '2026-07-18T00:00:00Z', 'fixed-id')
    expect(p.name).toBe('Profil principal')
    expect(p.avatar).toBe('👤')
  })
})
