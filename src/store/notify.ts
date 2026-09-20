/**
 * Notifications locales via l'API Notification (native dans Electron).
 * Dégradation silencieuse si refusé/indisponible — jamais de crash.
 */

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (typeof Notification === 'undefined') return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    const res = await Notification.requestPermission()
    return res === 'granted'
  } catch {
    return false
  }
}

export async function notifyLocal(title: string, body?: string): Promise<boolean> {
  const ok = await ensureNotificationPermission()
  if (!ok) return false
  try {
    new Notification(title, { body })
    return true
  } catch {
    return false
  }
}
