import { round2 } from '../money'
import { eachDay, inRange, type Range } from '../dates'
import { calcShiftPay, isWorked } from './shifts'
import type { Category, Shift, Transaction } from '../../types'

export interface IncomeEntry { date: string; amount: number; categoryKey: string; categoryId?: number; source: 'transaction' | 'shift' }

const SHIFT_PARTS = [['base', 'shift'], ['tips', 'tips'], ['bonus', 'bonus'], ['extra', 'side']] as const

/** Все ФАКТИЧЕСКИЕ доходы: записи доходов + отработанные смены (смены не дублируются транзакциями). */
export function buildIncomeEntries(shifts: Shift[], txs: Transaction[], cats: Category[]): IncomeEntry[] {
  const byId = new Map(cats.map((c) => [c.id, c]))
  const out: IncomeEntry[] = []
  for (const t of txs) {
    if (t.type !== 'income') continue
    out.push({ date: t.date, amount: t.amount, categoryKey: byId.get(t.categoryId)?.key ?? `cat:${t.categoryId}`, categoryId: t.categoryId, source: 'transaction' })
  }
  for (const s of shifts) {
    if (!isWorked(s)) continue
    const pay = calcShiftPay(s)
    for (const [part, key] of SHIFT_PARTS) if (pay[part] > 0) out.push({ date: s.date, amount: pay[part], categoryKey: key, source: 'shift' })
  }
  return out
}

export const sum = (nums: number[]): number => round2(nums.reduce((a, b) => a + b, 0))
export const incomeIn = (entries: IncomeEntry[], r: Range): number => sum(entries.filter((e) => inRange(e.date, r)).map((e) => e.amount))
export const expenseIn = (txs: Transaction[], r: Range): number => sum(txs.filter((t) => t.type === 'expense' && inRange(t.date, r)).map((t) => t.amount))

export interface DayPoint { date: string; income: number; expense: number }

export function dailySeries(entries: IncomeEntry[], txs: Transaction[], r: Range): DayPoint[] {
  const map = new Map<string, DayPoint>()
  for (const d of eachDay(r)) map.set(d, { date: d, income: 0, expense: 0 })
  for (const e of entries) { const p = map.get(e.date); if (p) p.income = round2(p.income + e.amount) }
  for (const t of txs) { if (t.type !== 'expense') continue; const p = map.get(t.date); if (p) p.expense = round2(p.expense + t.amount) }
  return [...map.values()]
}

export interface CategorySlice { categoryId: number; name: string; color: string; amount: number; count: number; share: number }

export function expensesByCategory(txs: Transaction[], cats: Category[], r: Range): CategorySlice[] {
  const byId = new Map(cats.map((c) => [c.id!, c]))
  const acc = new Map<number, { amount: number; count: number }>()
  let total = 0
  for (const t of txs) {
    if (t.type !== 'expense' || !inRange(t.date, r)) continue
    const a = acc.get(t.categoryId) ?? { amount: 0, count: 0 }
    a.amount = round2(a.amount + t.amount); a.count += 1
    acc.set(t.categoryId, a); total += t.amount
  }
  return [...acc.entries()]
    .map(([id, a]) => {
      const c = byId.get(id)
      return { categoryId: id, name: c?.name ?? 'Без категории', color: c?.color ?? '#9c9ca8', amount: a.amount, count: a.count, share: total > 0 ? (a.amount / total) * 100 : 0 }
    })
    .sort((a, b) => b.amount - a.amount)
}

export interface ShiftStats { count: number; hours: number; earned: number; avgPerShift: number; avgRate: number }

export function shiftStats(shifts: Shift[], r: Range): ShiftStats {
  const worked = shifts.filter((s) => isWorked(s) && inRange(s.date, r))
  const hours = round2(worked.reduce((a, s) => a + (s.hours || 0), 0))
  const earned = round2(worked.reduce((a, s) => a + calcShiftPay(s).total, 0))
  const count = worked.length
  return { count, hours, earned, avgPerShift: count ? round2(earned / count) : 0, avgRate: hours > 0 ? round2(earned / hours) : 0 }
}

/** Баланс: начальный остаток + фактические доходы − фактические расходы (до сегодня). Будущие платежи не учитываются. */
export function currentBalance(opening: number, entries: IncomeEntry[], txs: Transaction[], today: string): number {
  const inc = sum(entries.filter((e) => e.date <= today).map((e) => e.amount))
  const exp = sum(txs.filter((t) => t.type === 'expense' && t.date <= today).map((t) => t.amount))
  return round2(opening + inc - exp)
}
