import { useEffect } from 'react'
import { useStore } from './useStore'
import { deadlineAlerts, remindersDue } from '../core/alerts'
import { notifyLocal } from './notify'

/**
 * Boucle de surveillance locale (§6.6, §7.3) : toutes les 30 s,
 * - rappels d'événements (fenêtre [début − rappel, début]),
 * - alertes d'échéance (dépassement imminent sur échéance dure, ou constaté),
 * - déclencheur d'automatisations « échéance proche ».
 * Chaque alerte n'est notifiée qu'une fois par session (clé dédupliquée).
 * Dégradation silencieuse si les notifications sont refusées.
 */
export function useReminders() {
  useEffect(() => {
    const notified = new Set<string>()

    function tick() {
      const now = new Date()
      const { data, runDueSoonAutomations } = useStore.getState()

      for (const r of remindersDue(data.events, now)) {
        if (notified.has(r.key)) continue
        notified.add(r.key)
        void notifyLocal(
          r.title || 'Événement',
          `Commence à ${r.occurrenceStart.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
        )
      }

      for (const a of deadlineAlerts(data.tasks, data.statuses, now)) {
        const key = `dl:${a.taskId}:${a.dueDate}:${a.kind}`
        if (notified.has(key)) continue
        notified.add(key)
        void notifyLocal(
          a.kind === 'overdue' ? 'Échéance dépassée' : 'Échéance imminente',
          a.title || 'Tâche sans titre'
        )
      }

      runDueSoonAutomations(now)
    }

    tick()
    const id = window.setInterval(tick, 30000)
    return () => window.clearInterval(id)
  }, [])
}
