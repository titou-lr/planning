import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, type AppSection } from '../store/useStore'
import { searchPages, normalize } from '../core/search'
import { findPage } from '../core/tree'
import {
  IconFile, IconDatabase, IconPlus, IconSettings, IconUndo, IconRedo, IconSearch, IconTemplate,
  IconCheckCircle, IconFolder, IconCycle, IconTarget, IconChart, IconZap, IconCalendar, IconActivity,
} from './icons'

interface Command {
  id: string
  section: string
  label: string
  hint?: string
  icon: React.ReactNode
  run: () => void
}

/**
 * Command palette (DESIGN.md §6.8) : recherche transverse dans toutes
 * les pages (plein texte) + actions globales, navigable au clavier.
 */
export default function CommandPalette({ onClose, onOpenSettings }: { onClose: () => void; onOpenSettings: () => void }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const pages = useStore((s) => s.data.pages)
  const tasks = useStore((s) => s.data.tasks)
  const events = useStore((s) => s.data.events)

  useEffect(() => inputRef.current?.focus(), [])

  const commands = useMemo<Command[]>(() => {
    const go = (id: string) => () => {
      useStore.getState().setCurrentPage(id)
      onClose()
    }

    const goSection = (s: AppSection) => () => {
      useStore.getState().setSection(s)
      onClose()
    }

    const navIcons: Record<string, React.ReactNode> = {
      tasks: <IconCheckCircle width={14} height={14} />,
      projects: <IconFolder width={14} height={14} />,
      cycles: <IconCycle width={14} height={14} />,
      goals: <IconTarget width={14} height={14} />,
      reports: <IconChart width={14} height={14} />,
      automations: <IconZap width={14} height={14} />,
      calendar: <IconCalendar width={14} height={14} />,
      habits: <IconActivity width={14} height={14} />,
    }

    const navActions: Command[] = (
      [
        ['tasks', 'Aller aux tâches'], ['projects', 'Aller aux projets'], ['cycles', 'Aller aux cycles'],
        ['goals', 'Aller aux objectifs'], ['reports', 'Aller aux rapports'],
        ['automations', 'Aller aux automatisations'], ['calendar', 'Aller au calendrier'],
        ['habits', 'Aller aux habitudes'],
      ] as [AppSection, string][]
    ).map(([s, label]) => ({
      id: `nav-${s}`, section: 'Navigation', label, icon: navIcons[s], run: goSection(s),
    }))

    const actions: Command[] = [
      {
        id: 'new-task', section: 'Actions', label: 'Nouvelle tâche',
        icon: <IconCheckCircle width={14} height={14} />,
        run: () => {
          const id = useStore.getState().createTask()
          useStore.getState().setSelectedTask(id)
          useStore.getState().setSection('tasks')
          onClose()
        },
      },
      {
        id: 'new-event', section: 'Actions', label: 'Nouvel événement',
        icon: <IconCalendar width={14} height={14} />,
        run: () => { useStore.getState().createEvent(); useStore.getState().setSection('calendar'); onClose() },
      },
      {
        id: 'new-project', section: 'Actions', label: 'Nouveau projet',
        icon: <IconFolder width={14} height={14} />,
        run: () => {
          const id = useStore.getState().createProject()
          useStore.getState().setSelectedProject(id)
          useStore.getState().setSection('projects')
          onClose()
        },
      },
      {
        id: 'new-page', section: 'Actions', label: 'Nouvelle page',
        icon: <IconPlus width={14} height={14} />,
        run: () => { useStore.getState().setCurrentPage(useStore.getState().createPage(null)); onClose() },
      },
      {
        id: 'new-db', section: 'Actions', label: 'Nouvelle base de données',
        icon: <IconDatabase width={14} height={14} />,
        run: () => { useStore.getState().setCurrentPage(useStore.getState().createDatabase(null)); onClose() },
      },
      {
        id: 'undo', section: 'Actions', label: 'Annuler', hint: 'Ctrl Z',
        icon: <IconUndo width={14} height={14} />,
        run: () => { useStore.getState().undo(); onClose() },
      },
      {
        id: 'redo', section: 'Actions', label: 'Rétablir', hint: 'Ctrl ⇧ Z',
        icon: <IconRedo width={14} height={14} />,
        run: () => { useStore.getState().redo(); onClose() },
      },
      {
        id: 'settings', section: 'Actions', label: 'Réglages, export et import',
        icon: <IconSettings width={14} height={14} />,
        run: () => { onOpenSettings(); onClose() },
      },
      ...pages.filter((p) => p.kind === 'template').map((t) => ({
        id: `tpl-${t.id}`, section: 'Actions',
        label: `Nouvelle page depuis « ${t.title || 'Sans titre'} »`,
        icon: <IconTemplate width={14} height={14} />,
        run: () => {
          const id = useStore.getState().createFromTemplate(t.id, null)
          if (id) useStore.getState().setCurrentPage(id)
          onClose()
        },
      })),
    ]

    const goTask = (id: string) => () => {
      useStore.getState().setSelectedTask(id)
      useStore.getState().setSection('tasks')
      onClose()
    }

    if (!query.trim()) {
      // Sans requête : pages récentes + actions + navigation
      const recent = [...pages]
        .filter((p) => p.kind !== 'template')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6)
        .map((p) => ({
          id: `page-${p.id}`, section: 'Pages récentes',
          label: p.title || 'Sans titre',
          icon: p.kind === 'database' ? <IconDatabase width={14} height={14} /> : <IconFile width={14} height={14} />,
          run: go(p.id),
        }))
      return [...recent, ...actions, ...navActions]
    }

    // Recherche transverse : pages (plein texte), tâches, événements
    const q = normalize(query.trim())
    const terms = q.split(/\s+/).filter(Boolean)
    const matches = (text: string) => {
      const n = normalize(text)
      return terms.every((t) => n.includes(t))
    }

    const results = searchPages(pages, query, 10).map((r) => {
      const p = findPage(pages, r.pageId)
      return {
        id: `page-${r.pageId}`, section: 'Pages',
        label: p?.title || 'Sans titre',
        hint: r.excerpt || undefined,
        icon: p?.kind === 'database' ? <IconDatabase width={14} height={14} /> : <IconFile width={14} height={14} />,
        run: go(r.pageId),
      }
    })

    const taskResults = tasks
      .filter((t) => matches(t.title) || t.blocks.some((b) => b.text && matches(b.text)))
      .slice(0, 8)
      .map((t) => ({
        id: `task-${t.id}`, section: 'Tâches',
        label: t.title || 'Sans titre',
        icon: <IconCheckCircle width={14} height={14} />,
        run: goTask(t.id),
      }))

    const eventResults = events
      .filter((e) => e.title && matches(e.title))
      .slice(0, 5)
      .map((e) => ({
        id: `event-${e.id}`, section: 'Événements',
        label: e.title,
        hint: new Date(e.start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        icon: <IconCalendar width={14} height={14} />,
        run: () => { useStore.getState().setSection('calendar'); onClose() },
      }))

    const matchingActions = [...actions, ...navActions].filter((a) => matches(a.label))
    return [...results, ...taskResults, ...eventResults, ...matchingActions]
  }, [query, pages, tasks, events, onClose, onOpenSettings])

  useEffect(() => setSelected(0), [query])

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, commands.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); commands[selected]?.run() }
  }

  let lastSection = ''

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="palette" onKeyDown={onKey}>
        <div className="palette-input">
          <IconSearch width={15} height={15} style={{ color: 'var(--ink-tertiary)' }} />
          <input
            ref={inputRef}
            value={query}
            placeholder="Rechercher une page ou une action…"
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="palette-list scroll">
          {commands.length === 0 && (
            <div className="cmd-row" style={{ color: 'var(--ink-tertiary)', cursor: 'default' }}>
              Aucun résultat
            </div>
          )}
          {commands.map((c, i) => {
            const header = c.section !== lastSection ? <div className="cmd-section">{c.section}</div> : null
            lastSection = c.section
            return (
              <div key={c.id}>
                {header}
                <div
                  className={`cmd-row${i === selected ? ' on' : ''}`}
                  onMouseEnter={() => setSelected(i)}
                  onClick={c.run}
                >
                  {c.icon}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                  {c.hint && (
                    <span className="caption" style={{ marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260, flex: 'none' }}>
                      {c.hint}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
