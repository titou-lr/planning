import type { WorkspaceData } from '../core/types'
import { normalizeWorkspace } from '../core/workspace'
import type { Profile } from './profileService'

/**
 * Export/import global : une sauvegarde = un fichier JSON portable.
 * L'import valide la forme minimale et dégrade silencieusement
 * (jamais de crash sur fichier corrompu).
 */

export interface BackupFile {
  app: 'suite-locale'
  version: 1
  exportedAt: string
  profileName: string
  data: WorkspaceData
}

export function makeBackup(data: WorkspaceData, profile: Profile | null): BackupFile {
  return {
    app: 'suite-locale',
    version: 1,
    exportedAt: new Date().toISOString(),
    profileName: profile?.name ?? 'default',
    data,
  }
}

/** Parse un fichier de sauvegarde. Retourne null si invalide.
 *  Toutes les tranches (notes, tâches, calendrier…) passent par la
 *  normalisation : une sauvegarde d'une version antérieure reste valide. */
export function parseBackup(json: string): WorkspaceData | null {
  try {
    const raw = JSON.parse(json) as Partial<BackupFile>
    const data = raw?.data
    if (!data || !Array.isArray(data.pages)) return null
    return normalizeWorkspace({
      ...data,
      pages: data.pages.filter((p) => p && typeof p.id === 'string'),
    })
  } catch {
    return null
  }
}

/** Déclenche un téléchargement de fichier côté renderer (action explicite). */
export function downloadFile(filename: string, content: string, mime = 'application/json'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Ouvre un sélecteur de fichier et retourne le contenu texte. */
export function pickFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      const reader = new FileReader()
      reader.onload = () => resolve({ name: file.name, text: String(reader.result ?? '') })
      reader.onerror = () => resolve(null)
      reader.readAsText(file)
    }
    input.click()
  })
}
