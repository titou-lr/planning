import { useState } from 'react'
import { getProfiles, saveProfile, deleteProfile, setActiveProfile, type Profile } from '../store/profileService'
import { uid } from '../core/id'
import { IconPlus, IconTrash } from './icons'

const AVATARS = ['🗂️', '🌙', '🌿', '⚡', '🎯', '📐', '🔭', '🪶']

/**
 * Écran de sélection de profil au lancement. La sélection recharge
 * l'app pour recréer le store avec la clé du profil (pattern PM).
 */
export default function ProfileSelect() {
  const [profiles, setProfiles] = useState<Profile[]>(getProfiles())
  const [creating, setCreating] = useState(profiles.length === 0)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function open(id: string) {
    setActiveProfile(id)
    window.location.reload()
  }

  function createProfile() {
    const trimmed = name.trim()
    if (!trimmed) return
    const p: Profile = {
      id: uid(), name: trimmed, avatar,
      createdAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    }
    saveProfile(p)
    open(p.id)
  }

  function removeProfile(id: string) {
    deleteProfile(id)
    setProfiles(getProfiles())
    setConfirmDelete(null)
    setCreating(getProfiles().length === 0)
  }

  return (
    <div className="col" style={{ height: '100vh', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
      <div className="col" style={{ alignItems: 'center', gap: 8 }}>
        <div className="headline">Qui utilise l’app&nbsp;?</div>
        <div className="caption">Chaque profil a ses propres données, stockées uniquement sur cette machine.</div>
      </div>

      {!creating && (
        <div className="col gap8" style={{ width: 360 }}>
          {profiles.map((p) => (
            <div key={p.id} className="scard row gap12" onClick={() => open(p.id)}>
              <span style={{ fontSize: 22 }}>{p.avatar}</span>
              <div className="col" style={{ flex: 1 }}>
                <span className="subhead">{p.name}</span>
                <span className="caption">
                  Dernier accès&nbsp;: {new Date(p.lastOpenedAt).toLocaleDateString('fr-FR')}
                </span>
              </div>
              {confirmDelete === p.id ? (
                <button
                  className="btn btn-sm btn-danger-ghost"
                  onClick={(e) => { e.stopPropagation(); removeProfile(p.id) }}
                >
                  Confirmer&nbsp;?
                </button>
              ) : (
                <button
                  className="btn btn-icon btn-sm btn-ghost"
                  title="Supprimer le profil et ses données"
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(p.id) }}
                >
                  <IconTrash width={14} height={14} />
                </button>
              )}
            </div>
          ))}
          <button className="btn btn-ghost" onClick={() => setCreating(true)}>
            <IconPlus width={14} height={14} /> Nouveau profil
          </button>
        </div>
      )}

      {creating && (
        <div className="panel col gap12" style={{ width: 360, padding: 20 }}>
          <label className="col gap6">
            <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>Nom du profil</span>
            <input
              className="input" autoFocus value={name} placeholder="ex. Perso"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createProfile()}
            />
          </label>
          <div className="col gap6">
            <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>Avatar</span>
            <div className="row gap6" style={{ flexWrap: 'wrap' }}>
              {AVATARS.map((a) => (
                <button
                  key={a}
                  className={`chip${a === avatar ? ' chip-active' : ''}`}
                  onClick={() => setAvatar(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="row gap8" style={{ justifyContent: 'flex-end' }}>
            {profiles.length > 0 && (
              <button className="btn btn-ghost" onClick={() => setCreating(false)}>Annuler</button>
            )}
            <button className="btn btn-primary" disabled={!name.trim()} onClick={createProfile}>
              Créer le profil
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
