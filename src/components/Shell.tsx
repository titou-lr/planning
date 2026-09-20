import { useEffect, useState } from 'react'
import type { Profile } from '../store/profileService'
import { requestProfileSwitch } from '../store/profileService'
import { useStore, type AppSection } from '../store/useStore'
import { useReminders } from '../store/useReminders'
import { useAiSettings } from '../store/aiSettings'
import { findPage, ancestorsOf } from '../core/tree'
import SidebarTree from './SidebarTree'
import CommandPalette from './CommandPalette'
import PageView from './PageView'
import DatabasePage from './database/DatabasePage'
import HomeView from './HomeView'
import SettingsModal from './SettingsModal'
import WorkView from './work/WorkView'
import ProjectsView from './work/ProjectsView'
import CyclesView from './work/CyclesView'
import GoalsView from './work/GoalsView'
import ReportsView from './work/ReportsView'
import AutomationsView from './work/AutomationsView'
import CalendarView from './calendar/CalendarView'
import HabitsView from './calendar/HabitsView'
import AssistantPanel from './assistant/AssistantPanel'
import { ToastHost } from './Toast'
import {
  IconHome, IconSearch, IconSettings, IconUndo, IconRedo,
  IconCheckCircle, IconFolder, IconCycle, IconTarget, IconChart, IconZap,
  IconCalendar, IconActivity, IconWand,
} from './icons'

const SECTION_TITLES: Record<AppSection, string> = {
  home: 'Accueil', notes: 'Notes',
  tasks: 'Tâches', projects: 'Projets', cycles: 'Cycles', goals: 'Objectifs',
  reports: 'Rapports', automations: 'Automatisations',
  calendar: 'Calendrier', habits: 'Habitudes',
}

export default function Shell({ profile }: { profile: Profile }) {
  const currentPageId = useStore((s) => s.currentPageId)
  const section = useStore((s) => s.section)
  const pages = useStore((s) => s.data.pages)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)

  useReminders()

  // Réglages IA du profil (chargés depuis le stockage, chiffré le cas échéant)
  useEffect(() => {
    void useAiSettings.getState().load()
  }, [])

  const showPage = section === 'notes' || section === 'home'
  const currentPage = showPage && currentPageId ? findPage(pages, currentPageId) : undefined
  const breadcrumb = currentPage ? ancestorsOf(pages, currentPage.id) : []

  // Raccourcis globaux : Ctrl+K palette, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y undo-redo
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setAssistantOpen((v) => !v)
        return
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        useStore.getState().undo()
        return
      }
      if ((mod && e.shiftKey && e.key.toLowerCase() === 'z') || (mod && e.key.toLowerCase() === 'y')) {
        e.preventDefault()
        useStore.getState().redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function switchProfile() {
    // Demande explicite : l'écran de sélection reprend la main au rechargement
    // (sous le shell, la session compte + Jarvis survivent au reload).
    requestProfileSwitch()
    window.location.reload()
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="ws-switch" onClick={switchProfile} title="Changer de profil">
          <span style={{ fontSize: 18 }}>{profile.avatar}</span>
          <div className="col ws-label" style={{ minWidth: 0 }}>
            <span className="subhead" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.name}</span>
            <span className="caption" style={{ fontSize: 11 }}>Espace local</span>
          </div>
        </div>

        <div className="col" style={{ padding: '4px 0' }}>
          <div
            className={`nav-item${section === 'home' && !currentPage ? ' on' : ''}`}
            onClick={() => { useStore.getState().setSection('home'); useStore.getState().setCurrentPage(null) }}
          >
            <IconHome width={14} height={14} />
            <span className="nav-label">Accueil</span>
          </div>
          <div className="nav-item" onClick={() => setPaletteOpen(true)}>
            <IconSearch width={14} height={14} />
            <span className="nav-label" style={{ flex: 1 }}>Rechercher</span>
            <span className="kbd nav-label">Ctrl K</span>
          </div>
          <div className={`nav-item${assistantOpen ? ' on' : ''}`} onClick={() => setAssistantOpen((v) => !v)}>
            <IconWand width={14} height={14} />
            <span className="nav-label" style={{ flex: 1 }}>Assistant</span>
            <span className="kbd nav-label">Ctrl J</span>
          </div>
          <div className="nav-item" onClick={() => setSettingsOpen(true)}>
            <IconSettings width={14} height={14} />
            <span className="nav-label">Réglages</span>
          </div>
        </div>

        <div className="eyebrow nav-label" style={{ color: 'var(--ink-tertiary)', padding: '8px 16px 2px' }}>Travail</div>
        <div className="col" style={{ padding: '2px 0' }}>
          {([
            ['tasks', 'Tâches', <IconCheckCircle key="i" width={14} height={14} />],
            ['projects', 'Projets', <IconFolder key="i" width={14} height={14} />],
            ['cycles', 'Cycles', <IconCycle key="i" width={14} height={14} />],
            ['goals', 'Objectifs', <IconTarget key="i" width={14} height={14} />],
            ['reports', 'Rapports', <IconChart key="i" width={14} height={14} />],
            ['automations', 'Automatisations', <IconZap key="i" width={14} height={14} />],
          ] as [AppSection, string, React.ReactNode][]).map(([id, label, icon]) => (
            <div key={id} className={`nav-item${section === id ? ' on' : ''}`} onClick={() => useStore.getState().setSection(id)}>
              {icon}
              <span className="nav-label">{label}</span>
            </div>
          ))}
        </div>

        <div className="eyebrow nav-label" style={{ color: 'var(--ink-tertiary)', padding: '8px 16px 2px' }}>Planification</div>
        <div className="col" style={{ padding: '2px 0' }}>
          {([
            ['calendar', 'Calendrier', <IconCalendar key="i" width={14} height={14} />],
            ['habits', 'Habitudes', <IconActivity key="i" width={14} height={14} />],
          ] as [AppSection, string, React.ReactNode][]).map(([id, label, icon]) => (
            <div key={id} className={`nav-item${section === id ? ' on' : ''}`} onClick={() => useStore.getState().setSection(id)}>
              {icon}
              <span className="nav-label">{label}</span>
            </div>
          ))}
        </div>

        <div className="eyebrow nav-label" style={{ color: 'var(--ink-tertiary)', padding: '8px 16px 2px' }}>Notes</div>
        <SidebarTree />
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="row gap6" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            {currentPage ? (
              <>
                {breadcrumb.map((a) => (
                  <span key={a.id} className="row gap6" style={{ flex: 'none' }}>
                    <button className="btn btn-sm btn-ghost" onClick={() => useStore.getState().setCurrentPage(a.id)}>
                      {a.icon ? `${a.icon} ` : ''}{a.title || 'Sans titre'}
                    </button>
                    <span className="caption">/</span>
                  </span>
                ))}
                <span className="subhead" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentPage.icon ? `${currentPage.icon} ` : ''}{currentPage.title || 'Sans titre'}
                </span>
              </>
            ) : (
              <span className="subhead">{SECTION_TITLES[section]}</span>
            )}
          </div>
          <button className="btn btn-icon btn-sm btn-ghost" title="Annuler (Ctrl+Z)" onClick={() => useStore.getState().undo()}>
            <IconUndo width={14} height={14} />
          </button>
          <button className="btn btn-icon btn-sm btn-ghost" title="Rétablir (Ctrl+Shift+Z)" onClick={() => useStore.getState().redo()}>
            <IconRedo width={14} height={14} />
          </button>
          <button className="cmdk no-print" onClick={() => setPaletteOpen(true)}>
            <IconSearch width={13} height={13} />
            <span style={{ flex: 1, textAlign: 'left' }}>Rechercher…</span>
            <span className="kbd">Ctrl K</span>
          </button>
        </header>

        {section === 'tasks' ? <WorkView />
          : section === 'projects' ? <ProjectsView />
          : section === 'cycles' ? <CyclesView />
          : section === 'goals' ? <GoalsView />
          : section === 'reports' ? <ReportsView />
          : section === 'automations' ? <AutomationsView />
          : section === 'calendar' ? <CalendarView />
          : section === 'habits' ? <HabitsView />
          : currentPage
            ? currentPage.kind === 'database'
              ? <DatabasePage key={currentPage.id} db={currentPage} />
              : <PageView key={currentPage.id} page={currentPage} />
            : <HomeView />}
      </div>

      {assistantOpen && (
        <AssistantPanel onClose={() => setAssistantOpen(false)} onOpenSettings={() => setSettingsOpen(true)} />
      )}

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} onOpenSettings={() => setSettingsOpen(true)} />}
      {settingsOpen && <SettingsModal profile={profile} onClose={() => setSettingsOpen(false)} />}
      <ToastHost />
    </div>
  )
}
