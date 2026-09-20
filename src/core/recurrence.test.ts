import { describe, expect, it } from 'vitest'
import { expandEvents, occurrences, toDateKey } from './recurrence'
import { makeEvent } from './testFactories'
import type { Recurrence } from './types'

const d = (s: string) => new Date(s)
const keys = (dates: Date[]) => dates.map(toDateKey)

describe('recurrence — occurrences', () => {
  it('événement simple : présent uniquement si dans la fenêtre', () => {
    const start = d('2026-07-10T10:00:00')
    expect(occurrences(null, start, d('2026-07-01'), d('2026-07-31'))).toHaveLength(1)
    expect(occurrences(null, start, d('2026-08-01'), d('2026-08-31'))).toHaveLength(0)
  })

  it('quotidien avec intervalle', () => {
    const r: Recurrence = { freq: 'daily', interval: 3 }
    const out = occurrences(r, d('2026-07-01T09:00:00'), d('2026-07-01'), d('2026-07-11T23:59:59'))
    expect(keys(out)).toEqual(['2026-07-01', '2026-07-04', '2026-07-07', '2026-07-10'])
    expect(out[0].getHours()).toBe(9)
  })

  it('hebdomadaire multi-jours (lun/mer/ven)', () => {
    // 2026-07-06 est un lundi
    const r: Recurrence = { freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] }
    const out = occurrences(r, d('2026-07-06T08:30:00'), d('2026-07-06'), d('2026-07-17T23:59:59'))
    expect(keys(out)).toEqual([
      '2026-07-06', '2026-07-08', '2026-07-10',
      '2026-07-13', '2026-07-15', '2026-07-17',
    ])
  })

  it('hebdomadaire toutes les 2 semaines : pas de dérive', () => {
    const r: Recurrence = { freq: 'weekly', interval: 2 }
    const out = occurrences(r, d('2026-01-05T10:00:00'), d('2026-01-01'), d('2026-03-01')) // lundis
    expect(keys(out)).toEqual(['2026-01-05', '2026-01-19', '2026-02-02', '2026-02-16'])
  })

  it('mensuel ancré au 31 : clampe les mois courts SANS dérive', () => {
    const r: Recurrence = { freq: 'monthly', interval: 1 }
    const out = occurrences(r, d('2026-01-31T12:00:00'), d('2026-01-01'), d('2026-05-31T23:59:59'))
    // Février 2026 (non bissextile) → 28 ; mars revient au 31 (l'ancre est conservée)
    expect(keys(out)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31'])
  })

  it('mensuel ancré au 31 en année bissextile : 29 février', () => {
    const r: Recurrence = { freq: 'monthly', interval: 1 }
    const out = occurrences(r, d('2028-01-31T12:00:00'), d('2028-02-01'), d('2028-03-31T23:59:59'))
    expect(keys(out)).toEqual(['2028-02-29', '2028-03-31'])
  })

  it('mensuel "dernier jour du mois"', () => {
    const r: Recurrence = { freq: 'monthly', interval: 1, monthlyMode: 'lastDay' }
    const out = occurrences(r, d('2026-01-31T18:00:00'), d('2026-01-01'), d('2026-04-30T23:59:59'))
    expect(keys(out)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('annuel ancré au 29 février : 28 hors bissextile, 29 les bissextiles', () => {
    const r: Recurrence = { freq: 'yearly', interval: 1 }
    const out = occurrences(r, d('2024-02-29T09:00:00'), d('2024-01-01'), d('2028-12-31'))
    expect(keys(out)).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29'])
  })

  it('until inclus, count global (consommé par les occurrences hors fenêtre)', () => {
    const rUntil: Recurrence = { freq: 'daily', interval: 1, until: '2026-07-03' }
    expect(keys(occurrences(rUntil, d('2026-07-01T10:00:00'), d('2026-07-01'), d('2026-07-31'))))
      .toEqual(['2026-07-01', '2026-07-02', '2026-07-03'])

    const rCount: Recurrence = { freq: 'daily', interval: 1, count: 5 }
    // Fenêtre qui commence après 3 occurrences : il n'en reste que 2
    expect(keys(occurrences(rCount, d('2026-07-01T10:00:00'), d('2026-07-04'), d('2026-07-31'))))
      .toEqual(['2026-07-04', '2026-07-05'])
  })

  it('longue récurrence sans dérive : 10 ans de mensuel au 15', () => {
    const r: Recurrence = { freq: 'monthly', interval: 1 }
    const out = occurrences(r, d('2026-01-15T10:00:00'), d('2036-01-01'), d('2036-12-31'))
    expect(out).toHaveLength(12)
    for (const o of out) {
      expect(o.getDate()).toBe(15)
      expect(o.getHours()).toBe(10) // l'heure ne dérive pas non plus (DST)
    }
  })
})

describe('recurrence — expandEvents', () => {
  it('applique la durée et exclut les exdates', () => {
    const ev = makeEvent({
      start: '2026-07-01T10:00:00',
      end: '2026-07-01T11:30:00',
      recurrence: { freq: 'daily', interval: 1 },
      exdates: [new Date('2026-07-02T10:00:00').toISOString()],
    })
    const occ = expandEvents([ev], d('2026-07-01'), d('2026-07-03T23:59:59'))
    expect(occ.map((o) => toDateKey(o.start))).toEqual(['2026-07-01', '2026-07-03'])
    expect(occ[0].end.getTime() - occ[0].start.getTime()).toBe(90 * 60 * 1000)
  })

  it('dégrade silencieusement un événement corrompu', () => {
    const bad = makeEvent({ start: 'n’importe quoi', end: 'aussi' })
    expect(expandEvents([bad], d('2026-01-01'), d('2026-12-31'))).toEqual([])
  })
})
