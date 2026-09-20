import { useStore } from '../../store/useStore'
import type { Habit } from '../../core/types'
import { CATEGORY_COLORS } from '../../core/types'
import { bestStreak, currentStreak, weekStartOf } from '../../core/habits'
import { toDateKey } from '../../core/recurrence'
import { catVar } from '../work/shared'
import { IconPlus, IconTrash } from '../icons'

const WEEKS_SHOWN = 16

/** Suivi d'habitudes (§7.5) : fréquence attendue, historique, streaks. */
export default function HabitsView() {
  const data = useStore((s) => s.data)
  const habits = data.habits.filter((h) => !h.archived)

  return (
    <div className="col" style={{ flex: 1, minHeight: 0 }}>
      <div className="view-toolbar">
        <span className="subhead">Habitudes</span>
        <span className="caption">cliquer une case pour marquer le jour · streak = série en cours</span>
        <span style={{ flex: 1 }} />
        <button className="btn btn-sm btn-primary" onClick={() => useStore.getState().createHabit({ name: 'Nouvelle habitude' })}>
          <IconPlus width={13} height={13} /> Habitude
        </button>
      </div>
      {!habits.length ? (
        <div className="empty-state">
          <span>Aucune habitude suivie.</span>
          <span className="caption">Exemples : sport 3× / semaine, lecture quotidienne…</span>
        </div>
      ) : (
        <div className="scroll" style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {habits.map((h) => <HabitCard key={h.id} habit={h} />)}
        </div>
      )}
    </div>
  )
}

function HabitCard({ habit }: { habit: Habit }) {
  const today = new Date()
  const todayKey = toDateKey(today)
  const done = new Set(habit.completions)
  const up = (patch: Partial<Habit>) => useStore.getState().updateHabit(habit.id, patch)

  // Grille type contributions : WEEKS_SHOWN semaines × 7 jours, semaine courante à droite
  const currentWeek = weekStartOf(today)
  const weeks: Date[][] = []
  for (let w = WEEKS_SHOWN - 1; w >= 0; w--) {
    const ws = new Date(currentWeek.getFullYear(), currentWeek.getMonth(), currentWeek.getDate() - w * 7)
    weeks.push(Array.from({ length: 7 }, (_, i) => new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i)))
  }

  const streak = currentStreak(habit, today)
  const best = bestStreak(habit, today)
  const unit = habit.frequency === 'daily' ? 'jour(s)' : 'semaine(s)'

  return (
    <div className="panel" style={{ padding: 16 }}>
      <div className="row gap8">
        <span className="dot" style={{ background: catVar(habit.color), width: 10, height: 10 }} />
        <input
          className="input" style={{ width: 220, fontWeight: 600 }}
          value={habit.name} placeholder="Nom de l'habitude"
          onChange={(e) => up({ name: e.target.value })}
        />
        <select
          value={habit.frequency}
          onChange={(e) => up({ frequency: e.target.value as Habit['frequency'] })}
          style={{ height: 28 }}
        >
          <option value="daily">Quotidienne</option>
          <option value="weekly">Hebdomadaire</option>
        </select>
        {habit.frequency === 'weekly' && (
          <span className="row gap4">
            <input
              type="number" className="input mono" style={{ width: 56, height: 28 }} min={1} max={7}
              value={habit.timesPerWeek}
              onChange={(e) => up({ timesPerWeek: Math.min(7, Math.max(1, Number(e.target.value) || 1)) })}
            />
            <span className="caption">fois / semaine</span>
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span className="row gap6" title="Couleur">
          {CATEGORY_COLORS.slice(0, 6).map((c) => (
            <span
              key={c} className="dot"
              style={{
                background: catVar(c), cursor: 'pointer',
                outline: habit.color === c ? '2px solid var(--primary)' : undefined, outlineOffset: 1,
              }}
              onClick={() => up({ color: c })}
            />
          ))}
        </span>
        <button
          className="btn btn-icon btn-sm btn-danger-ghost"
          onClick={() => { if (window.confirm('Supprimer cette habitude et son historique ?')) useStore.getState().deleteHabit(habit.id) }}
        >
          <IconTrash width={13} height={13} />
        </button>
      </div>

      <div className="row gap16" style={{ marginTop: 14, alignItems: 'flex-start' }}>
        <div className="habit-grid">
          {weeks.map((week, wi) => (
            <div key={wi} className="habit-col">
              {week.map((d) => {
                const key = toDateKey(d)
                const future = key > todayKey
                const on = done.has(key)
                return (
                  <span
                    key={key}
                    className={`habit-cell${future ? ' future' : ''}`}
                    style={on ? { background: catVar(habit.color) } : undefined}
                    title={`${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}${on ? ' ✓' : ''}`}
                    onClick={() => { if (!future) useStore.getState().toggleHabitDay(habit.id, key) }}
                  />
                )
              })}
            </div>
          ))}
        </div>
        <div className="col gap4" style={{ flex: 1 }}>
          <div className="row gap16">
            <div className="col">
              <span className="kpi-label">Streak</span>
              <span className="kpi-value">{streak} <span className="caption">{unit}</span></span>
            </div>
            <div className="col">
              <span className="kpi-label">Record</span>
              <span className="kpi-value">{best} <span className="caption">{unit}</span></span>
            </div>
            <div className="col">
              <span className="kpi-label">Total</span>
              <span className="kpi-value">{habit.completions.length}</span>
            </div>
          </div>
          <button
            className={`btn btn-sm ${done.has(todayKey) ? 'btn-secondary' : 'btn-primary'}`}
            style={{ alignSelf: 'flex-start', marginTop: 8 }}
            onClick={() => useStore.getState().toggleHabitDay(habit.id, todayKey)}
          >
            {done.has(todayKey) ? '✓ Fait aujourd’hui' : 'Marquer aujourd’hui'}
          </button>
        </div>
      </div>
    </div>
  )
}
