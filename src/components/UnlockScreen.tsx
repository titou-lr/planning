import { useState } from 'react'
import type { Profile } from '../store/profileService'
import { requestProfileSwitch } from '../store/profileService'
import { CHECK_PLAINTEXT, decryptString, deriveKey } from '../core/crypto'
import { provideSessionKey } from '../store/secureStorage'

/** Déverrouillage d'un profil chiffré (§4) : le mot de passe dérive la clé de session. */
export default function UnlockScreen({ profile, onUnlocked }: { profile: Profile; onUnlocked: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function unlock() {
    if (!password || busy || !profile.enc) return
    setBusy(true)
    setError('')
    const key = await deriveKey(password, profile.enc.salt)
    const check = await decryptString(profile.enc.check, key)
    if (check !== CHECK_PLAINTEXT) {
      setError('Mot de passe incorrect.')
      setBusy(false)
      return
    }
    provideSessionKey(key)
    onUnlocked()
  }

  return (
    <div className="col" style={{ minHeight: '100vh', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <span style={{ fontSize: 32 }}>{profile.avatar}</span>
      <span className="title">{profile.name}</span>
      <span className="caption" style={{ maxWidth: 360, textAlign: 'center' }}>
        Ce profil est chiffré. Sans le mot de passe, les données sont irrécupérables — il n'existe aucun serveur de récupération.
      </span>
      <div className="col gap8" style={{ width: 280 }}>
        <input
          className="input"
          type="password"
          autoFocus
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void unlock() }}
        />
        {error && <span className="caption" style={{ color: 'var(--danger)' }}>{error}</span>}
        <button className="btn btn-primary" disabled={!password || busy} onClick={() => void unlock()}>
          {busy ? 'Vérification…' : 'Déverrouiller'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => { requestProfileSwitch(); window.location.reload() }}>
          Changer de profil
        </button>
      </div>
    </div>
  )
}
