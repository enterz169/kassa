import { addDays, addMonths, differenceInCalendarDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'

export const DATE_FMT = 'yyyy-MM-dd'

export const toStr = (d: Date): string => format(d, DATE_FMT)
export const todayStr = (): string => toStr(new Date())
export const parse = (s: string): Date => parseISO(s)
export const isDateStr = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseISO(s).getTime())

export const addDaysStr = (s: string, n: number): string => toStr(addDays(parse(s), n))
export const daysBetween = (from: string, to: string): number => differenceInCalendarDays(parse(to), parse(from))
export const monthKey = (s: string): string => s.slice(0, 7)
export const monthStart = (s: string): string => toStr(startOfMonth(parse(s)))
export const monthEnd = (s: string): string => toStr(endOfMonth(parse(s)))
export const addMonthsStr = (s: string, n: number): string => toStr(addMonths(parse(s), n))

/** Прибавить n месяцев с «зажимом» дня по длине месяца (31 → 30/28) */
export function addMonthsClamp(anchor: string, n: number, day: number): string {
  const base = addMonths(startOfMonth(parse(anchor)), n)
  const last = endOfMonth(base).getDate()
  return toStr(new Date(base.getFullYear(), base.getMonth(), Math.min(Math.max(day, 1), last)))
}

export const fmtDate = (s: string, pattern = 'd MMMM yyyy'): string => format(parse(s), pattern, { locale: ru })
export const fmtShort = (s: string): string => format(parse(s), 'd MMM', { locale: ru })
export const fmtDayMonth = (s: string): string => format(parse(s), 'd MMMM', { locale: ru })
export const fmtWeekday = (s: string): string => format(parse(s), 'EEEE', { locale: ru })
export const fmtWeekdayShort = (s: string): string => format(parse(s), 'EEEEEE', { locale: ru })
export const fmtMonthYear = (s: string): string => {
  const t = format(parse(s), 'LLLL yyyy', { locale: ru })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
export const fmtMonthShort = (s: string): string => format(parse(s), 'LLL', { locale: ru })
export const fmtFullToday = (): string => format(new Date(), 'EEEE, d MMMM', { locale: ru })

export function relativeDay(s: string, today = todayStr()): string {
  const d = daysBetween(today, s)
  if (d === 0) return 'сегодня'
  if (d === 1) return 'завтра'
  if (d === -1) return 'вчера'
  return fmtShort(s)
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}

export type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'halfyear' | 'year' | 'custom'
export interface Range { from: string; to: string }

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: 'Сегодня', yesterday: 'Вчера', week: 'Неделя', month: 'Месяц',
  quarter: '3 месяца', halfyear: '6 месяцев', year: 'Год', custom: 'Период',
}

/** Неделя — пн–вс текущей; месяц — текущий; 3/6/12 месяцев — последние N календарных месяцев, включая текущий. */
export function resolvePeriod(key: PeriodKey, custom?: Range, today = todayStr()): Range {
  const t = parse(today)
  switch (key) {
    case 'today': return { from: today, to: today }
    case 'yesterday': { const y = toStr(subDays(t, 1)); return { from: y, to: y } }
    case 'week': return { from: toStr(startOfWeek(t, { weekStartsOn: 1 })), to: toStr(endOfWeek(t, { weekStartsOn: 1 })) }
    case 'month': return { from: toStr(startOfMonth(t)), to: toStr(endOfMonth(t)) }
    case 'quarter': return { from: toStr(startOfMonth(addMonths(t, -2))), to: toStr(endOfMonth(t)) }
    case 'halfyear': return { from: toStr(startOfMonth(addMonths(t, -5))), to: toStr(endOfMonth(t)) }
    case 'year': return { from: toStr(startOfMonth(addMonths(t, -11))), to: toStr(endOfMonth(t)) }
    case 'custom': return custom && custom.from <= custom.to ? custom : { from: today, to: today }
  }
}

export const inRange = (date: string, r: Range): boolean => date >= r.from && date <= r.to

export function rangeLabel(r: Range): string {
  if (r.from === r.to) return fmtDate(r.from)
  const a = parse(r.from)
  const b = parse(r.to)
  const left = format(a, a.getFullYear() === b.getFullYear() ? 'd MMM' : 'd MMM yyyy', { locale: ru })
  return `${left} – ${format(b, 'd MMM yyyy', { locale: ru })}`
}

export function previousRange(r: Range): Range {
  const len = daysBetween(r.from, r.to) + 1
  return { from: addDaysStr(r.from, -len), to: addDaysStr(r.from, -1) }
}

export function eachDay(r: Range): string[] {
  const out: string[] = []
  const n = daysBetween(r.from, r.to)
  for (let i = 0; i <= n; i++) out.push(addDaysStr(r.from, i))
  return out
}

export function eachMonth(r: Range): string[] {
  const out: string[] = []
  let cur = monthStart(r.from)
  const last = monthStart(r.to)
  while (cur <= last) { out.push(cur); cur = addMonthsStr(cur, 1) }
  return out
}
