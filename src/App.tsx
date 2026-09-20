import { useState } from 'react'
import { getActiveProfile, getProfiles } from './store/profileService'
import { hasSessionKey } from './store/secureStorage'
import ProfileSelect from './components/ProfileSelect'
import UnlockScreen from './components/UnlockScreen'
import Shell from './components/Shell'

export default function App() {
  const [, forceRender] = useState(0)
  const active = getActiveProfile()
  const profiles = getProfiles()
  // Écran de sélection si aucun profil actif (ou aucun profil créé)
  if (!active || profiles.length === 0) return <ProfileSelect />
  // Profil chiffré (§4) : mot de passe requis avant l'hydratation du store
  if (active.enc && !hasSessionKey()) {
    return <UnlockScreen profile={active} onUnlocked={() => forceRender((n) => n + 1)} />
  }
  return <Shell profile={active} />
}
