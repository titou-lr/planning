/**
 * Profils locaux — même pattern que Patrimoine Manager :
 * liste des profils en localStorage, profil actif en sessionStorage,
 * clé de store applicative dynamique par profil.
 */

export interface Profile {
  id: string
  name: string
  /** Emoji avatar. */
  avatar: string
  createdAt: string
  lastOpenedAt: string
  /** Chiffrement optionnel (§4) : sel PBKDF2 + blob de vérification du mot de passe. */
  enc?: { salt: string; check: string }
}

import { isEmbeddedInShell, moduleKV } from '@jarvis/data-layer/renderer'

const kv = moduleKV('planning')

const PROFILES_KEY = 'suite-profiles'
const ACTIVE_KEY = 'suite-active-profile'
const DATA_PREFIX = 'suite-data-'
/** Profil retenu pour le compte shell (clé kv → déjà préfixée par compte). */
const SHELL_PROFILE_KEY = 'suite-shell-profile'
/** Flag sessionStorage : l'utilisateur a explicitement demandé à changer de profil. */
const SWITCH_FLAG_KEY = 'suite-profile-switching'

export function getProfiles(): Profile[] {
  try {
    const raw = JSON.parse(kv.getItem(PROFILES_KEY) ?? '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function saveProfile(profile: Profile): void {
  const profiles = getProfiles()
  const idx = profiles.findIndex((p) => p.id === profile.id)
  if (idx >= 0) profiles[idx] = profile
  else profiles.push(profile)
  kv.setItem(PROFILES_KEY, JSON.stringify(profiles))
}

export function deleteProfile(id: string): void {
  const updated = getProfiles().filter((p) => p.id !== id)
  kv.setItem(PROFILES_KEY, JSON.stringify(updated))
  kv.removeItem(`${DATA_PREFIX}${id}`)
}

export function getActiveProfileId(): string | null {
  return sessionStorage.getItem(ACTIVE_KEY)
}

export function setActiveProfile(id: string): void {
  sessionStorage.setItem(ACTIVE_KEY, id)
  sessionStorage.removeItem(SWITCH_FLAG_KEY)
  const p = getProfiles().find((pr) => pr.id === id)
  if (p) saveProfile({ ...p, lastOpenedAt: new Date().toISOString() })
  // Sous le shell : mémorise le choix pour ce compte (unification compte↔profil)
  if (isEmbeddedInShell()) kv.setItem(SHELL_PROFILE_KEY, id)
}

export function clearActiveProfile(): void {
  sessionStorage.removeItem(ACTIVE_KEY)
}

export function getActiveProfile(): Profile | null {
  const id = getActiveProfileId()
  if (!id) return null
  return getProfiles().find((p) => p.id === id) ?? null
}

export function getStoreKey(): string {
  const id = getActiveProfileId()
  return id ? `${DATA_PREFIX}${id}` : `${DATA_PREFIX}default`
}

// ── Unification compte shell ↔ profil (shell CLAUDE.md §5/§6) ───────────────
// Sous le shell, le compte connecté correspond directement à un profil du
// module : pas de second écran de sélection. Le multi-profil interne reste
// accessible via un changement explicite (requestProfileSwitch → ProfileSelect).

/** Décision pure de correspondance compte→profil — testée unitairement. */
export function resolveShellProfile(
  profiles: Profile[],
  rememberedId: string | null
): { kind: 'use'; id: string } | { kind: 'create' } {
  if (rememberedId && profiles.some((p) => p.id === rememberedId)) {
    return { kind: 'use', id: rememberedId }
  }
  if (profiles.length > 0) {
    // Profils préexistants (app standalone migrée) : le plus récemment ouvert
    const sorted = [...profiles].sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))
    return { kind: 'use', id: sorted[0].id }
  }
  return { kind: 'create' }
}

/** Fabrique le profil par défaut d'un compte shell — pur, testé. */
export function buildShellDefaultProfile(
  account: { accountName?: string; accountAvatar?: string },
  nowIso: string,
  id: string = crypto.randomUUID()
): Profile {
  return {
    id,
    name: account.accountName?.trim() || 'Profil principal',
    avatar: account.accountAvatar || '👤',
    createdAt: nowIso,
    lastOpenedAt: nowIso,
  }
}

/** L'utilisateur demande explicitement l'écran de sélection de profil. */
export function requestProfileSwitch(): void {
  sessionStorage.setItem(SWITCH_FLAG_KEY, '1')
  clearActiveProfile()
}

export function isProfileSwitchRequested(): boolean {
  return sessionStorage.getItem(SWITCH_FLAG_KEY) === '1'
}

/**
 * Garantit un profil actif quand le module tourne sous le shell.
 * Exécutée à l'import du service (donc avant la création des stores zustand,
 * qui dépendent de getStoreKey()) — sauf si un changement de profil explicite
 * est en cours (l'écran de sélection reprend alors la main).
 */
function ensureShellProfile(): void {
  if (!isEmbeddedInShell()) return
  const shell = window.jarvisShell
  if (!shell?.accountId) return
  if (isProfileSwitchRequested()) return
  const current = getActiveProfileId()
  const profiles = getProfiles()
  if (current && profiles.some((p) => p.id === current)) return
  const decision = resolveShellProfile(profiles, kv.getItem(SHELL_PROFILE_KEY))
  if (decision.kind === 'use') {
    setActiveProfile(decision.id)
  } else {
    const profile = buildShellDefaultProfile(shell, new Date().toISOString())
    saveProfile(profile)
    setActiveProfile(profile.id)
  }
}

ensureShellProfile()
