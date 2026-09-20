import { describe, expect, it } from 'vitest'
import { bestStreak, completionRate, currentStreak, weekStartOf } from './habits'
import { makeHabit } from './testFactories'

const today = new Date(2026, 6, 15) // mercredi 15 juillet 2026

describe('habits — streaks', () => {
  it('quotidien : streak consécutif incluant aujourd’hui', () => {
    const h = makeHabit({ completions: ['2026-07-13', '2026-07-14', '2026-07-15'] })
    expect(currentStreak(h, today)).toBe(3)
  })

  it('quotidien : la journée en cours non faite ne casse pas le streak', () => {
    const h = makeHabit({ completions: ['2026-07-13', '2026-07-14'] })
    expect(currentStreak(h, today)).toBe(2)
  })

  it('quotidien : un trou casse le streak', () => {
    const h = makeHabit({ completions: ['2026-07-11', '2026-07-12', '2026-07-14', '2026-07-15'] })
    expect(currentStreak(h, today)).toBe(2)
  })

  it('quotidien : bestStreak trouve la meilleure série historique', () => {
    const h = makeHabit({
      completions: ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-07-14', '2026-07-15'],
    })
    expect(bestStreak(h, today)).toBe(4)
  })

  it('hebdomadaire : semaines consécutives au quota', () => {
    const h = makeHabit({
      frequency: 'weekly', timesPerWeek: 2,
      completions: [
        '2026-06-29', '2026-07-01', // semaine du 29/06 : 2 ✓
        '2026-07-07', '2026-07-09', // semaine du 06/07 : 2 ✓
        '2026-07-13', // semaine en cours : 1 (pas encore ratée)
      ],
    })
    expect(currentStreak(h, today)).toBe(2)
  })

  it('hebdomadaire : la semaine en cours compte dès que le quota est atteint', () => {
    const h = makeHabit({
      frequency: 'weekly', timesPerWeek: 1,
      completions: ['2026-07-07', '2026-07-13'],
    })
    expect(currentStreak(h, today)).toBe(2)
  })

  it('weekStartOf : lundi, y compris pour un dimanche', () => {
    expect(weekStartOf(new Date(2026, 6, 19)).getDate()).toBe(13) // dimanche 19 → lundi 13
    expect(weekStartOf(new Date(2026, 6, 13)).getDate()).toBe(13)
  })

  it('completionRate sur fenêtre glissante', () => {
    const h = makeHabit({ completions: ['2026-07-15', '2026-07-13'] })
    expect(completionRate(h, today, 4)).toBe(0.5) // 12,13,14,15 → 2/4
  })
})
