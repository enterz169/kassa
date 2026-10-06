import { addDays, endOfWeek, startOfWeek } from 'date-fns'
import { daysBetween, eachDay, eachMonth, fmtMonthShort, fmtShort, monthEnd, parse, toStr, type Range } from '../dates'

export interface Bucket { key: string; label: string; from: string; to: string }
export type Granularity = 'day' | 'week' | 'month'

/** Группировка периода для графиков: до 31 дня — по дням, до 100 дней — по неделям, дальше — по месяцам. */
export function bucketsFor(r: Range): { granularity: Granularity; list: Bucket[] } {
  const days = daysBetween(r.from, r.to) + 1
  if (days <= 31) {
    return { granularity: 'day', list: eachDay(r).map((d) => ({ key: d, label: String(parse(d).getDate()), from: d, to: d })) }
  }
  if (days <= 100) {
    const list: Bucket[] = []
    let cur = startOfWeek(parse(r.from), { weekStartsOn: 1 })
    const last = parse(r.to)
    while (cur <= last) {
      const from = toStr(cur) < r.from ? r.from : toStr(cur)
      const wEnd = toStr(endOfWeek(cur, { weekStartsOn: 1 }))
      const to = wEnd > r.to ? r.to : wEnd
      list.push({ key: from, label: fmtShort(from), from, to })
      cur = addDays(cur, 7)
    }
    return { granularity: 'week', list }
  }
  return { granularity: 'month', list: eachMonth(r).map((m) => ({ key: m, label: fmtMonthShort(m), from: m < r.from ? r.from : m, to: monthEnd(m) > r.to ? r.to : monthEnd(m) })) }
}

export const GRAN_LABEL: Record<Granularity, string> = { day: 'по дням', week: 'по неделям', month: 'по месяцам' }
