import { daysBetween, eachDay, parse, type Range } from '../dates'

export type PatternKind = 'cycle' | 'weekdays'
export interface Pattern { kind: PatternKind; work?: number; off?: number; days?: number[] }

export const PRESETS: { id: string; label: string; hint: string; pattern: Pattern }[] = [
  { id: '2/2', label: '2/2', hint: '2 рабочих, 2 выходных', pattern: { kind: 'cycle', work: 2, off: 2 } },
  { id: '5/2', label: '5/2', hint: 'пн–пт', pattern: { kind: 'weekdays', days: [1, 2, 3, 4, 5] } },
  { id: '3/3', label: '3/3', hint: '3 рабочих, 3 выходных', pattern: { kind: 'cycle', work: 3, off: 3 } },
  { id: 'days', label: 'По дням недели', hint: 'выберите дни', pattern: { kind: 'weekdays', days: [1, 3, 5] } },
  { id: 'cycle', label: 'Свой цикл', hint: 'X через Y', pattern: { kind: 'cycle', work: 1, off: 2 } },
]

export const MAX_SPAN_DAYS = 366
export interface Planned { date: string; work: boolean }

/** Раскладывает шаблон по датам периода: цикл считается от первого дня периода, дни недели — 1 = пн … 7 = вс. */
export function expandPattern(p: Pattern, r: Range): Planned[] {
  if (daysBetween(r.from, r.to) + 1 > MAX_SPAN_DAYS || r.to < r.from) return []
  const days = eachDay(r)
  if (p.kind === 'weekdays') {
    const set = new Set(p.days ?? [])
    return days.map((date) => ({ date, work: set.has(parse(date).getDay() || 7) }))
  }
  const work = Math.max(1, Math.floor(p.work ?? 1))
  const off = Math.max(0, Math.floor(p.off ?? 0))
  const len = work + off
  return days.map((date, i) => ({ date, work: i % len < work }))
}
