/**
 * Types TS communs au shell et aux packages transverses (CLAUDE.md §2).
 * Les types métier de chaque module restent dans le module — ici ne vivent
 * que l'identité (compte local), la session et l'audit Jarvis.
 */

/** Compte utilisateur local (CLAUDE.md §5) — la version stockée côté main. */
export interface ShellAccountRecord {
  id: string
  firstName: string
  lastName: string
  username: string
  email: string
  /** Emoji ou initiales choisies comme avatar. */
  avatar: string
  /** Hash argon2/bcrypt — ne quitte JAMAIS le process principal. */
  passwordHash: string
  createdAt: string
  lastLoginAt: string | null
}

/** Vue « publique » d'un compte, transmise au renderer (sans hash). */
export type ShellAccount = Omit<ShellAccountRecord, 'passwordHash'>

/** Token de réinitialisation de mot de passe (affiché à l'écran, pas d'e-mail réel). */
export interface PasswordResetRequest {
  accountId: string
  token: string
  /** ISO — expiration (usage unique). */
  expiresAt: string
  used: boolean
}

/** Session persistée via Electron safeStorage quand « rester connecté ». */
export interface SessionRecord {
  accountId: string
  token: string
  createdAt: string
}

/** Niveau de confiance d'une action Jarvis (CLAUDE.md §7.4). */
export type ActionImpact = 'routine' | 'sensitive'

/** Entrée du journal d'audit Jarvis (CLAUDE.md §7.4). */
export interface JarvisAuditEntry {
  id: string
  timestamp: string
  accountId: string
  module: string
  action: string
  params: unknown
  status: 'ok' | 'error' | 'refused'
  /** Résumé sérialisable du résultat (jamais l'objet métier complet). */
  resultSummary: string
  /** true si l'utilisateur a annulé l'action a posteriori depuis le journal. */
  undone?: boolean
}
