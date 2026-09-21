import { useState, type FormEvent } from 'react'
import {
  sendMagicLink, signOutCloud, syncNow, verifyEmailCode,
} from '../cloud/cloudSync'
import { useCloudSync } from '../cloud/cloudState'

const STATUS_LABELS = {
  unconfigured: 'Non configuré',
  signed_out: 'Non connecté',
  awaiting_email: 'Lien envoyé',
  connecting: 'Connexion…',
  syncing: 'Synchronisation…',
  synced: 'Synchronisé',
  offline: 'Hors ligne',
  error: 'Erreur',
} as const

export default function CloudSyncSettings() {
  const cloud = useCloudSync()
  const [email, setEmail] = useState(cloud.email ?? '')
  const [token, setToken] = useState('')
  const busy = cloud.status === 'connecting' || cloud.status === 'syncing'

  async function requestLink(event: FormEvent) {
    event.preventDefault()
    if (email.trim()) await sendMagicLink(email.trim())
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    if (email.trim() && token.trim()) await verifyEmailCode(email.trim(), token.trim())
  }

  return (
    <div className="col gap8">
      <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>Compte &amp; synchronisation</span>
      <div className="row gap8">
        <span className="chip">{STATUS_LABELS[cloud.status]}</span>
        {cloud.email ? <span className="caption">{cloud.email}</span> : null}
      </div>

      {cloud.status === 'unconfigured' ? (
        <span className="caption">La synchronisation cloud n’est pas configurée dans cet environnement.</span>
      ) : cloud.workspaceId ? (
        <>
          <span className="caption">
            Les modifications sont d’abord enregistrées sur cet appareil, puis synchronisées automatiquement.
            {cloud.lastSyncedAt ? ` Dernière synchronisation : ${new Date(cloud.lastSyncedAt).toLocaleString('fr-FR')}.` : ''}
          </span>
          <div className="row gap8">
            <button className="btn btn-secondary" disabled={busy} onClick={() => void syncNow()}>
              Synchroniser maintenant
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => void signOutCloud()}>
              Se déconnecter
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="caption">
            Recevez un lien de connexion par e-mail. Le premier appareil crée votre espace cloud ; les suivants récupèrent le même espace.
          </span>
          <form className="row gap8" onSubmit={requestLink}>
            <input
              className="input"
              type="email"
              autoComplete="email"
              placeholder="vous@exemple.fr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
              required
            />
            <button className="btn btn-primary" disabled={busy || !email.trim()} type="submit">
              Envoyer le lien
            </button>
          </form>
          {cloud.status === 'awaiting_email' ? (
            <>
              <span className="caption">Consultez votre boîte mail. Si le message contient un code à six chiffres, vous pouvez aussi le saisir ici.</span>
              <form className="row gap8" onSubmit={verifyCode}>
                <input
                  className="input mono"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                />
                <button className="btn btn-secondary" disabled={busy || token.trim().length < 6} type="submit">
                  Valider le code
                </button>
              </form>
            </>
          ) : null}
        </>
      )}
      {cloud.error ? <span className="caption" role="alert" style={{ color: 'var(--danger)' }}>{cloud.error}</span> : null}
    </div>
  )
}
