import { useEffect, useState, type ReactNode } from 'react'
import { initializeWorkspacePersistence } from '../store/workspacePersistence'

export default function WorkspaceGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let active = true
    void initializeWorkspacePersistence().then(
      () => { if (active) setStatus('ready') },
      () => { if (active) setStatus('error') },
    )
    return () => { active = false }
  }, [])

  if (status === 'loading') {
    return <div className="caption" style={{ padding: 24 }}>Préparation des données locales…</div>
  }
  if (status === 'error') {
    return <div className="caption" role="alert" style={{ padding: 24 }}>Impossible d’ouvrir les données locales.</div>
  }
  return children
}
