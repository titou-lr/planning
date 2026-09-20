import type { CalendarEvent, Recurrence } from './types'

/**
 * Moteur de récurrence (§7.1) — pur, déterministe, sans dérive.
 *
 * Principe d'ancrage : les occurrences sont TOUJOURS recalculées depuis
 * la date de départ (jamais depuis l'occurrence précédente). Un événement
 * mensuel ancré au 31 tombe le 28/29 février puis revient au 31 mars ;
 * un annuel ancré au 29 février tombe le 28 les années non bissextiles.
 * Dates manipulées en heure locale (app mono-machine, hors-ligne).
 */

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

function clampDayOfMonth(year: number, month0: number, day: number): Date {
  return new Date(year, month0, Math.min(day, daysInMonth(year, month0)))
}

function withTime(date: Date, anchor: Date): Date {
  const d = new Date(date)
  d.setHours(anchor.getHours(), anchor.getMinutes(), anchor.getSeconds(), 0)
  return d
}

/** Parse 'YYYY-MM-DD' en date locale (fin de journée pour une borne incluse). */
function parseUntil(until: string): Date {
  const [y, m, d] = until.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59)
}

/**
 * Occurrences de `recur` ancrées sur `dtstart`, dont le début tombe dans
 * [rangeStart, rangeEnd] (bornes incluses). `count`/`until` sont respectés
 * globalement (les occurrences avant rangeStart consomment le compteur).
 */
export function occurrences(
  recur: Recurrence | null,
  dtstart: Date,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  if (rangeEnd < rangeStart) return []
  if (!recur) {
    return dtstart >= rangeStart && dtstart <= rangeEnd ? [new Date(dtstart)] : []
  }

  const interval = Math.max(1, Math.floor(recur.interval || 1))
  const until = recur.until ? parseUntil(recur.until) : null
  const maxCount = recur.count && recur.count > 0 ? recur.count : Infinity
  const hardEnd = until && until < rangeEnd ? until : rangeEnd

  const out: Date[] = []
  let produced = 0

  const push = (d: Date): boolean => {
    // Toute occurrence (même hors fenêtre) consomme le compteur global.
    if (d < dtstart) return true
    if (until && d > until) return false
    if (produced >= maxCount) return false
    produced++
    if (d >= rangeStart && d <= rangeEnd) out.push(d)
    return d <= hardEnd || produced < maxCount
  }

  // Arithmétique par composantes calendaires (jamais par millisecondes) :
  // le constructeur Date normalise, donc aucun décalage aux changements
  // d'heure été/hiver.
  const y0 = dtstart.getFullYear()
  const m0 = dtstart.getMonth()
  const d0 = dtstart.getDate()

  if (recur.freq === 'daily') {
    for (let k = 0; ; k++) {
      const d = withTime(new Date(y0, m0, d0 + k * interval), dtstart)
      if (d > hardEnd || produced >= maxCount) break
      if (!push(d)) break
    }
  } else if (recur.freq === 'weekly') {
    const byWeekday = (recur.byWeekday?.length ? recur.byWeekday : [dtstart.getDay()])
      .slice()
      .sort((a, b) => a - b)
    // Semaine ancrée sur le dimanche de la semaine de départ
    const anchorOffset = -dtstart.getDay()
    for (let w = 0; ; w++) {
      const weekStart = new Date(y0, m0, d0 + anchorOffset + w * interval * 7)
      if (weekStart > hardEnd || produced >= maxCount) break
      for (const wd of byWeekday) {
        const d = withTime(new Date(y0, m0, d0 + anchorOffset + w * interval * 7 + wd), dtstart)
        if (d < dtstart) continue
        push(d)
        if (produced >= maxCount) break
      }
      if (produced >= maxCount) break
    }
  } else if (recur.freq === 'monthly') {
    const anchorDay = dtstart.getDate()
    const lastDay = recur.monthlyMode === 'lastDay'
    for (let k = 0; ; k++) {
      const monthIndex = dtstart.getMonth() + k * interval
      const year = dtstart.getFullYear() + Math.floor(monthIndex / 12)
      const month0 = ((monthIndex % 12) + 12) % 12
      const day = lastDay ? daysInMonth(year, month0) : anchorDay
      const d = withTime(clampDayOfMonth(year, month0, day), dtstart)
      if (d > hardEnd || produced >= maxCount) break
      if (!push(d)) break
    }
  } else {
    // yearly — ancre mois + quantième (29 février clampé au 28 hors bissextile)
    const anchorMonth = dtstart.getMonth()
    const anchorDay = dtstart.getDate()
    for (let k = 0; ; k++) {
      const year = dtstart.getFullYear() + k * interval
      const d = withTime(clampDayOfMonth(year, anchorMonth, anchorDay), dtstart)
      if (d > hardEnd || produced >= maxCount) break
      if (!push(d)) break
    }
  }

  return out
}

/** Occurrence concrète d'un événement (récurrent ou non) dans une fenêtre. */
export interface EventOccurrence {
  eventId: string
  /** ISO de début de CETTE occurrence (clé pour exdates). */
  start: Date
  end: Date
  isRecurring: boolean
}

/**
 * Développe une liste d'événements sur une fenêtre : applique la
 * récurrence, la durée d'origine et les occurrences exclues (exdates).
 * Dégrade silencieusement les événements aux dates invalides.
 */
export function expandEvents(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date
): EventOccurrence[] {
  const out: EventOccurrence[] = []
  for (const ev of events) {
    const start = new Date(ev.start)
    const end = new Date(ev.end)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue
    const durationMs = Math.max(0, end.getTime() - start.getTime())
    const ex = new Set((ev.exdates ?? []).map((x) => new Date(x).getTime()))
    for (const occ of occurrences(ev.recurrence, start, rangeStart, rangeEnd)) {
      if (ex.has(occ.getTime())) continue
      out.push({
        eventId: ev.id,
        start: occ,
        end: new Date(occ.getTime() + durationMs),
        isRecurring: ev.recurrence != null,
      })
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime())
}

/** Formatage local YYYY-MM-DD (jamais UTC : pas de décalage de jour). */
export function toDateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Parse 'YYYY-MM-DD' en date locale à minuit. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
