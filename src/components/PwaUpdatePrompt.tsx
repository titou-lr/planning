import { useRegisterSW } from 'virtual:pwa-register/react'

export default function PwaUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!offlineReady && !needRefresh) return null

  function close() {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <div className="toast" role="status" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span>{offlineReady ? 'Planning est prêt hors ligne.' : 'Une nouvelle version est disponible.'}</span>
      {needRefresh ? (
        <button className="btn btn-sm btn-primary" onClick={() => void updateServiceWorker(true)}>
          Mettre à jour
        </button>
      ) : null}
      <button className="btn btn-sm btn-ghost" onClick={close}>Fermer</button>
    </div>
  )
}
