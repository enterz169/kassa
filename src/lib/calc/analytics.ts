import { eachMonth, inRange, monthEnd, previousRange, type Range } from '../dates'
import { round2 } from '../money'
import { buildIncomeEntries, expensesByCategory, expenseIn, incomeIn, shiftStats, sum, type CategorySlice, type IncomeEntry, type ShiftStats } from './finance'
import { isOpen } from './loans'
import { isWorked } from './shifts'
import type { Category, Loan, LoanPayment, Shift, Transaction } from '../../types'

export interface MonthPoint { month: string; income: number; expense: number; net: number; shiftEarned: number; shifts: number; hours: number }

export function monthlySeries(shifts: Shift[], entries: IncomeEntry[], txs: Transaction[], r: Range): MonthPoint[] {
  return eachMonth(r).map((m) => {
    const mr = { from: m, to: monthEnd(m) }
    const income = incomeIn(entries, mr)
    const expense = expenseIn(txs, mr)
    const st = shiftStats(shifts, mr)
    return { month: m, income, expense, net: round2(income - expense), shiftEarned: st.earned, shifts: st.count, hours: st.hours }
  })
}

export interface PeriodTotals { income: number; expense: number; net: number }
export type PaymentRow = LoanPayment & { loanName: string }

export interface Report {
  range: Range
  prevRange: Range
  income: number
  expense: number
  net: number
  shiftIncome: number
  otherIncome: number
  stats: ShiftStats
  byCategory: CategorySlice[]
  paid: PaymentRow[]
  paidTotal: number
  upcoming: PaymentRow[]
  upcomingTotal: number
  prev: PeriodTotals | null
}

/** Отчёт строится только из фактических данных; предстоящие платежи — отдельный блок и в расходы не входят. */
export function buildReport(range: Range, shifts: Shift[], txs: Transaction[], cats: Category[], loans: Loan[], payments: LoanPayment[], today: string): Report {
  const entries = buildIncomeEntries(shifts, txs, cats)
  const inc = incomeIn(entries, range)
  const exp = expenseIn(txs, range)
  const shiftIncome = sum(entries.filter((e) => e.source === 'shift' && inRange(e.date, range)).map((e) => e.amount))
  const name = new Map(loans.map((l) => [l.id, l.name]))

  const paid = payments
    .filter((p) => p.status === 'paid' && p.paidDate && inRange(p.paidDate, range))
    .map((p) => ({ ...p, loanName: name.get(p.loanId) ?? 'Кредит' }))
    .sort((a, b) => a.paidDate!.localeCompare(b.paidDate!))
  const upFrom = range.from > today ? range.from : today
  const upcoming = payments
    .filter((p) => isOpen(p) && p.plannedDate >= upFrom && p.plannedDate <= range.to)
    .map((p) => ({ ...p, loanName: name.get(p.loanId) ?? 'Кредит' }))
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))

  const prevRange = previousRange(range)
  const pInc = incomeIn(entries, prevRange)
  const pExp = expenseIn(txs, prevRange)
  const hasPrev = pInc > 0 || pExp > 0 || shifts.some((s) => inRange(s.date, prevRange) && isWorked(s))

  return {
    range, prevRange, income: inc, expense: exp, net: round2(inc - exp), shiftIncome, otherIncome: round2(inc - shiftIncome),
    stats: shiftStats(shifts, range), byCategory: expensesByCategory(txs, cats, range),
    paid, paidTotal: sum(paid.map((p) => p.amount)), upcoming, upcomingTotal: sum(upcoming.map((p) => p.amount)),
    prev: hasPrev ? { income: pInc, expense: pExp, net: round2(pInc - pExp) } : null,
  }
}

/** Изменение в процентах; null, если база нулевая. */
export function pctChange(now: number, before: number): number | null {
  if (before <= 0) return null
  return ((now - before) / before) * 100
}
