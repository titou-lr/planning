import { create } from 'zustand'
import { getActiveProfileId } from './profileService'
import { secureStorage } from './secureStorage'

/**
 * Réglages de l'assistant IA — cloisonnés PAR PROFIL (§4) et stockés via
 * `secureStorage` : sur un profil chiffré, la clé API est chiffrée au
 * repos comme le reste des données. Jamais envoyés ailleurs qu'à l'API
 * Anthropic lors d'un appel explicite.
 */

export interface AiSettings {
  apiKey: string
  /** Mode "auto-application" du triage (§8) — opt-in explicite. */
  autoTriage: boolean
}

const LEGACY_KEY = 'suite-ai-settings'

/** Clé de stockage des réglages IA du profil actif (exposée pour le chiffrement §4). */
export function aiSettingsKey(): string {
  const id = getActiveProfileId()
  return id ? `suite-ai-${id}` : 'suite-ai-default'
}

interface AiSettingsState extends AiSettings {
  loaded: boolean
  load: () => Promise<void>
  save: (patch: Partial<AiSettings>) => void
}

function parse(raw: string | null): Partial<AiSettings> {
  try {
    return raw ? (JSON.parse(raw) as Partial<AiSettings>) : {}
  } catch {
    return {}
  }
}

export const useAiSettings = create<AiSettingsState>((set, get) => ({
  apiKey: '',
  autoTriage: false,
  loaded: false,

  load: async () => {
    let raw = await secureStorage.getItem(aiSettingsKey())
    // Migration de l'ancienne clé globale (en clair) vers la clé par profil
    if (raw === null) {
      const legacy = localStorage.getItem(LEGACY_KEY)
      if (legacy !== null) {
        await secureStorage.setItem(aiSettingsKey(), legacy)
        localStorage.removeItem(LEGACY_KEY)
        raw = legacy
      }
    }
    const parsed = parse(raw)
    set({
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      autoTriage: parsed.autoTriage === true,
      loaded: true,
    })
  },

  save: (patch) => {
    const next: AiSettings = { apiKey: get().apiKey, autoTriage: get().autoTriage, ...patch }
    set(next)
    void secureStorage.setItem(aiSettingsKey(), JSON.stringify(next))
  },
}))

/** Lecture ponctuelle hors React (service IA, actions). */
export function getAiSettings(): AiSettings {
  const { apiKey, autoTriage } = useAiSettings.getState()
  return { apiKey, autoTriage }
}
