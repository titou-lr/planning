import type { Habit } from './types'
import { toDateKey, fromDateKey } from './recurrence'

/**
 * Suivi d'habitudes (§7.5) — calculs de streaks purs.
 * Habitude quotidienne : streak = jours consécutifs jusqu'à aujourd'hui
 * (ou hier : la journée en cours n'est pas encore "ratée").
 * Habitude hebdomadaire : semaines consécutives atteignant le quota.
 */

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** Lundi de la semaine de `d` (convention FR). */
export function weekStartOf(d: Date): Date {
  const wd = (d.getDay() + 6) % 7 // 0 = lundi
  return addDays(d, -wd)
}

export function currentStreak(habit: Habit, today: Date): number {
  const done = new Set(habit.completions)
  if (habit.frequency === 'daily') {
    let streak = 0
    // La journée en cours compte si complétée, sinon on part d'hier
    let cursor = done.has(toDateKey(today)) ? today : addDays(today, -1)
    while (done.has(toDateKey(cursor))) {
      streak++
      cursor = addDays(cursor, -1)
    }
    return streak
  }
  // weekly : quota par semaine
  const quota = Math.max(1, habit.timesPerWeek)
  const countInWeek = (weekStart: Date): number => {
    let n = 0
    for (let i = 0; i < 7; i++) if (done.has(toDateKey(addDays(weekStart, i)))) n++
    return n
  }
  let streak = 0
  let week = weekStartOf(today)
  // La semaine en cours compte si le quota est déjà atteint, sinon on
  // part de la semaine précédente (elle n'est pas encore "ratée").
  if (countInWeek(week) < quota) week = addDays(week, -7)
  while (countInWeek(week) >= quota) {
    streak++
    week = addDays(week, -7)
  }
  return streak
}

export function bestStreak(habit: Habit, today: Date): number {
  if (!habit.completions.length) return 0
  if (habit.frequency === 'daily') {
    const days = [...new Set(habit.completions)].sort()
    let best = 1
    let run = 1
    for (let i = 1; i < days.length; i++) {
      const prev = fromDateKey(days[i - 1])
      const cur = fromDateKey(days[i])
      if (toDateKey(addDays(prev, 1)) === toDateKey(cur)) run++
      else run = 1
      if (run > best) best = run
    }
    return best
  }
  // weekly : parcourt les semaines de la première complétion à aujourd'hui
  const quota = Math.max(1, habit.timesPerWeek)
  const done = new Set(habit.completions)
  const sorted = [...habit.completions].sort()
  let week = weekStartOf(fromDateKey(sorted[0]))
  const endWeek = weekStartOf(today)
  let best = 0
  let run = 0
  while (week <= endWeek) {
    let n = 0
    for (let i = 0; i < 7; i++) if (done.has(toDateKey(addDays(week, i)))) n++
    run = n >= quota ? run + 1 : 0
    if (run > best) best = run
    week = addDays(week, 7)
  }
  return best
}

/** Taux de complétion sur les `days` derniers jours (quotidien uniquement). */
export function completionRate(habit: Habit, today: Date, days: number): number {
  if (days <= 0) return 0
  const done = new Set(habit.completions)
  let n = 0
  for (let i = 0; i < days; i++) if (done.has(toDateKey(addDays(today, -i)))) n++
  return n / days
}
