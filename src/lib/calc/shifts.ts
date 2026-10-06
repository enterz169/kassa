import { round2 } from '../money'
import type { Shift } from '../../types'

const toMin = (t: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return null
  const h = Number(m[1]); const mm = Number(m[2])
  if (h > 23 || mm > 59) return null
  return h * 60 + mm
}

/** Ночная смена: конец раньше начала → +24 ч. */
export function minutesBetween(start?: string, end?: string): number | null {
  if (!start || !end) return null
  const a = toMin(start); const b = toMin(end)
  if (a === null || b === null) return null
  let d = b - a
  if (d <= 0) d += 24 * 60
  return d
}

export function calcHours(start: string | undefined, end: string | undefined, breakMin: number): number | null {
  const m = minutesBetween(start, end)
  if (m === null) return null
  return Math.max(0, round2((m - Math.max(0, breakMin)) / 60))
}

export interface ShiftPay { base: number; tips: number; bonus: number; extra: number; total: number }
type PayInput = Pick<Shift, 'payMode' | 'hours' | 'rate' | 'fixedPay' | 'manualTotal' | 'tips' | 'bonus' | 'extra'>

/**
 * Единый расчёт заработка смены без двойного учёта:
 *  hourly: часы × ставка + чаевые + бонусы + доп.; fixed: оплата за смену + то же;
 *  manual: введённая вручную итоговая сумма уже включает всё — остальные поля игнорируются.
 */
export function calcShiftPay(s: PayInput): ShiftPay {
  if (s.payMode === 'manual') {
    const t = round2(s.manualTotal || 0)
    return { base: t, tips: 0, bonus: 0, extra: 0, total: t }
  }
  const base = s.payMode === 'fixed' ? round2(s.fixedPay || 0) : round2((s.hours || 0) * (s.rate || 0))
  const tips = round2(s.tips || 0)
  const bonus = round2(s.bonus || 0)
  const extra = round2(s.extra || 0)
  return { base, tips, bonus, extra, total: round2(base + tips + bonus + extra) }
}

export const isWorked = (s: Shift): boolean => s.status === 'work'
