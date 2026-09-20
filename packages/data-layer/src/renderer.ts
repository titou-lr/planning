/**
 * @jarvis/data-layer — côté renderer.
 *
 * Chaque module consomme `moduleKV('<module>')` comme stockage clé→valeur
 * (compatible zustand/persist StateStorage, API synchrone).
 *
 * Deux modes, résolus à l'exécution :
 * - Embarqué dans le shell Electron : le preload expose `window.jarvisData`
 *   (IPC synchrone vers la base SQLite unique, namespacée par module) et
 *   `window.jarvisShell.accountId` — les clés sont préfixées par compte
 *   pour le cloisonnement multi-comptes (CLAUDE.md §5).
 * - Lancé isolément (dev module seul, navigateur) : repli localStorage avec
 *   les clés historiques du module, inchangées — zéro migration en dev isolé.
 */

export interface JarvisDataBridge {
  get(namespace: string, key: string): string | null
  set(namespace: string, key: string, value: string): void
  delete(namespace: string, key: string): void
  query(namespace: string): Array<{ key: string; value: string }>
}

export interface JarvisShellInfo {
  accountId: string | null
  /** Identité affichable du compte — sert de base au profil par défaut des modules. */
  accountName?: string
  accountAvatar?: string
}

declare global {
  interface Window {
    jarvisData?: JarvisDataBridge
    jarvisShell?: JarvisShellInfo
  }
}

export function isEmbeddedInShell(): boolean {
  return typeof window !== 'undefined' && window.jarvisData !== undefined
}

function accountPrefix(): string {
  const id = typeof window !== 'undefined' ? window.jarvisShell?.accountId : null
  return id ? `${id}/` : ''
}

export interface ModuleKV {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  /** Liste des clés du namespace (compte courant), sans le préfixe compte. */
  keys(): string[]
}

/** Stockage namespacé d'un module. `ns` = 'planning' | 'earning' | 'running' | 'shell' | 'jarvis'. */
export function moduleKV(ns: string): ModuleKV {
  return {
    getItem(key) {
      if (isEmbeddedInShell()) return window.jarvisData!.get(ns, accountPrefix() + key)
      return localStorage.getItem(key)
    },
    setItem(key, value) {
      if (isEmbeddedInShell()) window.jarvisData!.set(ns, accountPrefix() + key, value)
      else localStorage.setItem(key, value)
    },
    removeItem(key) {
      if (isEmbeddedInShell()) window.jarvisData!.delete(ns, accountPrefix() + key)
      else localStorage.removeItem(key)
    },
    keys() {
      if (isEmbeddedInShell()) {
        const prefix = accountPrefix()
        return window.jarvisData!.query(ns)
          .map((r) => r.key)
          .filter((k) => k.startsWith(prefix))
          .map((k) => k.slice(prefix.length))
      }
      return Object.keys(localStorage)
    },
  }
}
