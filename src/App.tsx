import { useState } from 'react'
import { getActiveProfile, getProfiles } from './store/profileService'
import { hasSessionKey } from './store/secureStorage'
import ProfileSelect from './components/ProfileSelect'
import UnlockScreen from './components/UnlockScreen'
import Shell from './components/Shell'
import PwaUpdatePrompt from './components/PwaUpdatePrompt'
import WorkspaceGate from './components/WorkspaceGate'

export default function App() {
  const [, forceRender] = useState(0)
  const active = getActiveProfile()
  const profiles = getProfiles()
  const pwaPrompt = window.location.protocol === 'file:' ? null : <PwaUpdatePrompt />
  // Écran de sélection si aucun profil actif (ou aucun profil créé)
  if (!active || profiles.length === 0) return <><ProfileSelect />{pwaPrompt}</>
  // Profil chiffré (§4) : mot de passe requis avant l'hydratation du store
  if (active.enc && !hasSessionKey()) {
    return <><UnlockScreen profile={active} onUnlocked={() => forceRender((n) => n + 1)} />{pwaPrompt}</>
  }
  return <><WorkspaceGate profile={active}><Shell profile={active} /></WorkspaceGate>{pwaPrompt}</>
}
