import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { Profile } from '../store/profileService'
import type { StatusCategory } from '../core/types'
import { CATEGORY_COLORS } from '../core/types'
import { STATUS_CATEGORIES } from '../core/workspace'
import { makeBackup, parseBackup, downloadFile, pickFile } from '../store/exportImport'
import { pageToMarkdown } from '../core/markdown'
import { notifyLocal } from '../store/notify'
import { uid } from '../core/id'
import { aiSettingsKey, useAiSettings } from '../store/aiSettings'
import { saveProfile } from '../store/profileService'
import { getStoreKey } from '../store/profileService'
import { CHECK_PLAINTEXT, deriveKey, encryptString, makeSalt } from '../core/crypto'
import {
  clearSessionKey, decryptStoredValue, encryptStoredValue, hasSessionKey, provideSessionKey,
} from '../store/secureStorage'
import PrintSpace from './PrintSpace'
import { useToast } from './Toast'
import { IconDownload, IconUpload, IconBell, IconX, IconUser, IconPlus, IconTrash, IconWand, IconAlert } from './icons'

/** Réglages : sauvegarde/restauration globale, export Markdown complet, notifications. */
export default function SettingsModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const data = useStore((s) => s.data)
  const show = useToast((s) => s.show)
  const [printOpen, setPrintOpen] = useState(false)

  function exportBackup() {
    const backup = makeBackup(data, profile)
    const date = new Date().toISOString().slice(0, 10)
    downloadFile(`suite-locale-${profile.name}-${date}.json`, JSON.stringify(backup, null, 2))
    show('Sauvegarde exportée')
  }

  async function importBackup() {
    const file = await pickFile('.json')
    if (!file) return
    const parsed = parseBackup(file.text)
    if (!parsed) { show('Fichier de sauvegarde invalide — rien n’a été modifié'); return }
    if (!window.confirm(`Remplacer les données du profil « ${profile.name} » par ${parsed.pages.length} pages importées ? (Annulable via Ctrl+Z)`)) return
    useStore.getState().replaceData(parsed)
    show(`${parsed.pages.length} pages restaurées`)
  }

  function exportAllMarkdown() {
    const md = data.pages
      .filter((p) => p.kind !== 'template')
      .map((p) => pageToMarkdown(p))
      .join('\n\n---\n\n')
    downloadFile('espace-complet.md', md, 'text/markdown')
    show('Espace complet exporté en Markdown')
  }

  async function testNotification() {
    const ok = await notifyLocal('Suite Locale', 'Les notifications locales fonctionnent.')
    show(ok ? 'Notification envoyée' : 'Notifications indisponibles ou refusées')
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal">
        <div className="subhead-bar spread">
          <span className="subhead">Réglages</span>
          <button className="btn btn-icon btn-sm btn-ghost" onClick={onClose}><IconX width={14} height={14} /></button>
        </div>
        <div className="scroll col gap16" style={{ padding: 16 }}>
          <div className="col gap6">
            <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>Profil</span>
            <div className="row gap10">
              <IconUser width={14} height={14} style={{ color: 'var(--ink-subtle)' }} />
              <span>{profile.avatar} {profile.name}</span>
              <span className="caption mono">{data.pages.length} pages</span>
            </div>
          </div>

          <div className="col gap8">
            <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>Sauvegarde &amp; restauration</span>
            <span className="caption">Une sauvegarde = un fichier JSON portable contenant toutes les données du profil (pages, bases, historique de versions).</span>
            <div className="row gap8">
              <button className="btn btn-secondary" onClick={exportBackup}>
                <IconDownload width={14} height={14} /> Exporter la sauvegarde
              </button>
              <button className="btn btn-secondary" onClick={importBackup}>
                <IconUpload width={14} height={14} /> Restaurer depuis un fichier
              </button>
            </div>
          </div>

          <div className="col gap8">
            <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>Export de l’espace complet</span>
            <div className="row gap8">
              <button className="btn btn-secondary" onClick={exportAllMarkdown}>
                <IconDownload width={14} height={14} /> Markdown
              </button>
              <button className="btn btn-secondary" onClick={() => setPrintOpen(true)}>
                <IconDownload width={14} height={14} /> PDF (impression)
              </button>
            </div>
          </div>

          <AiSettingsSection />
          <EncryptionSettings profile={profile} />

          <div className="col gap8">
            <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>Notifications locales</span>
            <span className="caption">Notifications natives du système, sans aucun serveur.</span>
            <button className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={testNotification}>
              <IconBell width={14} height={14} /> Tester une notification
            </button>
          </div>

          <WorkflowSettings />

          <div className="col gap4">
            <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>Raccourcis</span>
            <div className="row gap8"><span className="kbd">Ctrl K</span><span className="caption">Recherche &amp; commandes</span></div>
            <div className="row gap8"><span className="kbd">Ctrl Z</span><span className="caption">Annuler (global)</span></div>
            <div className="row gap8"><span className="kbd">Ctrl ⇧ Z</span><span className="caption">Rétablir</span></div>
            <div className="row gap8"><span className="kbd">Tab</span><span className="caption">Indenter une liste dans l’éditeur</span></div>
            <div className="row gap8"><span className="kbd">[[</span><span className="caption">Lier une page dans l’éditeur</span></div>
          </div>
        </div>
      </div>
      {printOpen && <PrintSpace onClose={() => setPrintOpen(false)} />}
    </>
  )
}

/** Assistant IA (§8) : clé API locale (par profil, chiffrée si le profil l'est) + auto-triage. */
function AiSettingsSection() {
  const settings = useAiSettings()

  return (
    <div className="col gap8">
      <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>
        <IconWand width={11} height={11} style={{ verticalAlign: -1, marginRight: 5 }} />
        Assistant IA
      </span>
      <span className="caption">
        La clé est stockée uniquement sur cette machine et ne sert qu’aux appels que tu déclenches.
        C’est la seule fonction de l’app qui utilise le réseau ; sans clé, tout le reste fonctionne hors-ligne.
      </span>
      <input
        className="input mono"
        type="password"
        placeholder="Clé API Anthropic (sk-ant-…)"
        value={settings.apiKey}
        onChange={(e) => settings.save({ apiKey: e.target.value.trim() })}
      />
      <label className="row gap8" style={{ cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={settings.autoTriage}
          onChange={(e) => settings.save({ autoTriage: e.target.checked })}
        />
        <span className="col">
          <span style={{ fontSize: 13 }}>Auto-application du triage</span>
          <span className="caption">
            Si activé, les propositions de triage (priorité, projet, étiquettes) sont appliquées
            sans carte de confirmation — chaque application reste annulable via Ctrl+Z.
            Toutes les autres actions de l’assistant demandent toujours confirmation.
          </span>
        </span>
      </label>
    </div>
  )
}

/** Chiffrement optionnel des données locales (§4). */
function EncryptionSettings({ profile }: { profile: Profile }) {
  const show = useToast((s) => s.show)
  const [enabled, setEnabled] = useState(Boolean(profile.enc))
  const [open, setOpen] = useState(false)
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)

  async function enable() {
    if (busy || pw1.length < 4 || pw1 !== pw2) return
    setBusy(true)
    try {
      const salt = makeSalt()
      const key = await deriveKey(pw1, salt)
      const check = await encryptString(CHECK_PLAINTEXT, key)
      provideSessionKey(key)
      await encryptStoredValue(getStoreKey(), key)
      await encryptStoredValue(aiSettingsKey(), key) // la clé API IA est aussi chiffrée
      saveProfile({ ...profile, enc: { salt, check } })
      setEnabled(true)
      setOpen(false)
      setPw1(''); setPw2('')
      show('Chiffrement activé pour ce profil')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    if (!profile.enc || !hasSessionKey()) return
    if (!window.confirm('Désactiver le chiffrement ? Les données de ce profil seront de nouveau stockées en clair sur cette machine.')) return
    setBusy(true)
    try {
      const key = await deriveKey(window.prompt('Mot de passe actuel :') ?? '', profile.enc.salt)
      const ok = await decryptStoredValue(getStoreKey(), key)
      if (!ok) { show('Mot de passe incorrect — rien n’a été modifié'); return }
      await decryptStoredValue(aiSettingsKey(), key)
      clearSessionKey()
      const { enc: _drop, ...rest } = profile
      saveProfile(rest)
      setEnabled(false)
      show('Chiffrement désactivé')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="col gap8">
      <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>Chiffrement des données locales</span>
      {enabled ? (
        <>
          <span className="caption">Les données de ce profil sont chiffrées (AES-256) — le mot de passe est demandé à chaque ouverture.</span>
          <button className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => void disable()}>
            Désactiver le chiffrement
          </button>
        </>
      ) : !open ? (
        <>
          <span className="caption">Optionnel : chiffre les données de ce profil sur le disque avec un mot de passe.</span>
          <button className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>
            Activer le chiffrement…
          </button>
        </>
      ) : (
        <div className="panel-flush col gap8" style={{ padding: 12 }}>
          <span className="row gap6" style={{ color: 'var(--warning)', fontSize: 12.5 }}>
            <IconAlert width={13} height={13} />
            Si tu oublies ce mot de passe, les données du profil sont définitivement perdues :
            il n’existe aucun serveur ni procédure de récupération. Pense à exporter une sauvegarde avant.
          </span>
          <input className="input" type="password" placeholder="Mot de passe (min. 4 caractères)" value={pw1} onChange={(e) => setPw1(e.target.value)} />
          <input className="input" type="password" placeholder="Confirmer le mot de passe" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          {pw2 && pw1 !== pw2 && <span className="caption" style={{ color: 'var(--danger)' }}>Les mots de passe ne correspondent pas.</span>}
          <div className="row gap6">
            <button className="btn btn-sm btn-primary" disabled={busy || pw1.length < 4 || pw1 !== pw2} onClick={() => void enable()}>
              Chiffrer ce profil
            </button>
            <button className="btn btn-sm btn-secondary" onClick={() => { setOpen(false); setPw1(''); setPw2('') }}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Workflow de tâches (§6.1), étiquettes et champs personnalisés. */
function WorkflowSettings() {
  const data = useStore((s) => s.data)
  const [labelName, setLabelName] = useState('')
  const [fieldName, setFieldName] = useState('')
  const statuses = [...data.statuses].sort((a, b) => a.order - b.order)

  return (
    <>
      <div className="col gap6">
        <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>Workflow des tâches</span>
        <span className="caption">Colonnes du kanban. La catégorie porte le sens (progression, rapports) même si le nom change.</span>
        {statuses.map((s) => (
          <div key={s.id} className="row gap6">
            <span className="dot" style={{ background: `var(--${s.color})` }} />
            <input
              className="input" style={{ flex: 1, height: 28 }}
              value={s.name}
              onChange={(e) => useStore.getState().updateStatus(s.id, { name: e.target.value })}
            />
            <select
              value={s.category}
              onChange={(e) => useStore.getState().updateStatus(s.id, { category: e.target.value as StatusCategory })}
              style={{ height: 28 }}
            >
              {STATUS_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              value={s.color}
              onChange={(e) => useStore.getState().updateStatus(s.id, { color: e.target.value })}
              style={{ height: 28, width: 90 }}
            >
              {CATEGORY_COLORS.map((c) => <option key={c} value={c}>{c.replace('cat-', '')}</option>)}
            </select>
            <button
              className="btn btn-icon btn-sm btn-danger-ghost"
              disabled={statuses.length <= 1}
              title="Supprimer (les tâches sont réaffectées au premier statut)"
              onClick={() => useStore.getState().deleteStatus(s.id)}
            >
              <IconTrash width={12} height={12} />
            </button>
          </div>
        ))}
        <button
          className="btn btn-sm btn-secondary" style={{ alignSelf: 'flex-start' }}
          onClick={() => useStore.getState().addStatus({ name: 'Nouveau statut', category: 'todo', color: 'cat-gray' })}
        >
          <IconPlus width={12} height={12} /> Statut
        </button>
      </div>

      <div className="col gap6">
        <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>Étiquettes</span>
        <div className="row gap6" style={{ flexWrap: 'wrap' }}>
          {data.labels.map((l) => (
            <span key={l.id} className="chip" style={{ height: 24 }}>
              <span className="dot" style={{ background: `var(--${l.color})` }} />
              {l.name}
              <span
                style={{ cursor: 'pointer', color: 'var(--ink-tertiary)' }}
                title="Supprimer l'étiquette (retirée des tâches)"
                onClick={() => useStore.getState().deleteLabel(l.id)}
              >×</span>
            </span>
          ))}
        </div>
        <div className="row gap6">
          <input
            className="input" style={{ height: 28, flex: 1 }} placeholder="Nouvelle étiquette…"
            value={labelName}
            onChange={(e) => setLabelName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && labelName.trim()) {
                useStore.getState().addLabel(labelName.trim(), CATEGORY_COLORS[data.labels.length % CATEGORY_COLORS.length])
                setLabelName('')
              }
            }}
          />
        </div>
      </div>

      <div className="col gap6">
        <span className="eyebrow" style={{ color: 'var(--ink-tertiary)' }}>Champs personnalisés des tâches</span>
        {data.taskFields.map((f) => (
          <div key={f.id} className="row gap6">
            <input
              className="input" style={{ flex: 1, height: 28 }} value={f.name}
              onChange={(e) => useStore.getState().updateTaskField(f.id, { name: e.target.value })}
            />
            <span className="caption mono" style={{ width: 70 }}>{f.type}</span>
            <button className="btn btn-icon btn-sm btn-danger-ghost" onClick={() => useStore.getState().removeTaskField(f.id)}>
              <IconTrash width={12} height={12} />
            </button>
          </div>
        ))}
        <div className="row gap6">
          <input
            className="input" style={{ height: 28, flex: 1 }} placeholder="Nom du champ…"
            value={fieldName} onChange={(e) => setFieldName(e.target.value)}
          />
          {(['text', 'number', 'date', 'checkbox'] as const).map((t) => (
            <button
              key={t} className="btn btn-sm btn-secondary" disabled={!fieldName.trim()}
              onClick={() => {
                useStore.getState().addTaskField({ id: uid(), name: fieldName.trim(), type: t })
                setFieldName('')
              }}
            >
              {t === 'text' ? 'Texte' : t === 'number' ? 'Nombre' : t === 'date' ? 'Date' : 'Case'}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
