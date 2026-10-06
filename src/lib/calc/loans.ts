import { addDaysStr, addMonthsClamp, daysBetween, inRange, monthEnd, monthKey, monthStart, parse, todayStr } from '../dates'
import { round2 } from '../money'
import { sum } from './finance'
import type { Loan, LoanPayment, PaymentState } from '../../types'

export const HORIZON_MONTHS = 12
export const SOON_DAYS = 3

export function paymentState(p: LoanPayment, today = todayStr()): PaymentState {
  if (p.status === 'paid') return 'paid'
  if (p.status === 'cancelled') return 'cancelled'
  const d = daysBetween(today, p.plannedDate)
  if (d < 0) return 'overdue'
  if (d <= SOON_DAYS) return 'soon'
  return 'upcoming'
}

export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  paid: 'Оплачен', cancelled: 'Отменён', overdue: 'Просрочен', soon: 'Скоро срок оплаты', upcoming: 'Предстоящий',
}
export const PAYMENT_STATE_COLOR: Record<PaymentState, string> = {
  paid: '#34d399', cancelled: '#6c6c78', overdue: '#fb5a6b', soon: '#fbbf24', upcoming: '#60a5fa',
}

export const isOpen = (p: LoanPayment): boolean => p.status === 'planned'

export function openPayments(payments: LoanPayment[], loanId?: number): LoanPayment[] {
  return payments.filter((p) => isOpen(p) && (loanId === undefined || p.loanId === loanId)).sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
}

export const nextPaymentOf = (loanId: number, payments: LoanPayment[]): LoanPayment | undefined => openPayments(payments, loanId)[0]

function paymentsUntil(first: string, end: string, day: number): number {
  let n = 0
  for (let i = 0; i < 600; i++) {
    const d = addMonthsClamp(first, i, day)
    if (d > end && monthKey(d) !== monthKey(end)) break
    n++
  }
  return n
}

/**
 * Сколько платежей осталось — только если это можно рассчитать достоверно:
 * 1) известна дата окончания; 2) известна общая сумма к погашению; 3) ставка явно 0 % (рассрочка).
 * Иначе null: проценты неизвестны, и «остаток / платёж» дал бы неверное число.
 */
export function remainingPayments(loan: Loan, payments: LoanPayment[]): number | null {
  const open = openPayments(payments, loan.id)
  const first = open[0]?.plannedDate ?? loan.nextPaymentDate
  if (loan.endDate) {
    if (monthKey(loan.endDate) < monthKey(first)) return 0
    return paymentsUntil(first, loan.endDate, loan.paymentDay)
  }
  if (loan.monthlyPayment <= 0) return null
  if (loan.totalToRepay && loan.totalToRepay > 0) {
    const paid = sum(payments.filter((p) => p.loanId === loan.id && p.status === 'paid').map((p) => p.amount))
    return Math.max(0, Math.ceil((loan.totalToRepay - paid) / loan.monthlyPayment))
  }
  if (loan.rate === 0 && loan.balance !== undefined) return Math.ceil(loan.balance / loan.monthlyPayment)
  return null
}

export interface PlannedPeriod { periodKey: string; plannedDate: string; amount: number }

/**
 * Какие платежи ещё нужно добавить в график. Существующие периоды (periodKey) пропускаются — защита от дублей.
 * Перенос платежа на другую дату не меняет его период, поэтому второй платёж за тот же месяц не создаётся.
 */
export function missingPeriods(loan: Loan, payments: LoanPayment[], today = todayStr(), horizonMonths = HORIZON_MONTHS, useAnchor = false): PlannedPeriod[] {
  const mine = payments.filter((p) => p.loanId === loan.id)
  const have = new Set(mine.map((p) => p.periodKey))
  const horizon = addMonthsClamp(today, horizonMonths, parse(today).getDate())
  const cap = remainingPayments(loan, payments)
  const planned = mine.filter((p) => p.status === 'planned').length
  let room = cap === null ? Infinity : Math.max(0, cap - planned)

  const fromLast = !useAnchor && mine.length > 0
  const base = fromLast ? `${mine.map((p) => p.periodKey).sort().pop()!}-01` : loan.nextPaymentDate
  const startI = fromLast ? 1 : 0

  const out: PlannedPeriod[] = []
  for (let i = startI; i < 240 && room > 0; i++) {
    const date = i === 0 ? loan.nextPaymentDate : addMonthsClamp(base, i, loan.paymentDay)
    if (date > horizon) break
    if (loan.endDate && date > loan.endDate && monthKey(date) !== monthKey(loan.endDate)) break
    const key = monthKey(date)
    if (have.has(key)) continue
    have.add(key)
    out.push({ periodKey: key, plannedDate: date, amount: loan.monthlyPayment })
    room--
  }
  return out
}

export interface ReserveInfo {
  state: 'none' | 'covered' | 'today' | 'overdue' | 'saving'
  payment?: LoanPayment
  amount: number
  saved: number
  left: number
  daysLeft: number | null
  perDay: number | null
}

/** Сколько откладывать: остаток к накоплению / дней до платежа. День платежа и просрочка — без деления на ноль. */
export function reserveInfo(loan: Loan, payments: LoanPayment[], today = todayStr()): ReserveInfo {
  const p = nextPaymentOf(loan.id!, payments)
  if (!p) return { state: 'none', amount: 0, saved: loan.reserved, left: 0, daysLeft: null, perDay: null }
  const left = Math.max(0, round2(p.amount - loan.reserved))
  const daysLeft = daysBetween(today, p.plannedDate)
  const base = { payment: p, amount: p.amount, saved: loan.reserved, left, daysLeft }
  if (left === 0) return { ...base, state: 'covered', perDay: 0 }
  if (daysLeft < 0) return { ...base, state: 'overdue', perDay: null }
  if (daysLeft === 0) return { ...base, state: 'today', perDay: null }
  return { ...base, state: 'saving', perDay: Math.ceil(left / daysLeft) }
}

export interface Commitments {
  overdue: number; next7: number; month: number; total: number; totalCount: number
  reserved: number; shortfall: number; perDay: number
}

export function commitments(loans: Loan[], payments: LoanPayment[], today = todayStr()): Commitments {
  const active = new Set(loans.filter((l) => !l.archived).map((l) => l.id!))
  const open = payments.filter((p) => isOpen(p) && active.has(p.loanId))
  const week = { from: today, to: addDaysStr(today, 7) }
  const month = { from: monthStart(today), to: monthEnd(today) }
  let shortfall = 0
  let perDay = 0
  for (const l of loans) {
    if (l.archived) continue
    const info = reserveInfo(l, payments, today)
    shortfall += info.left
    if (info.perDay) perDay += info.perDay
  }
  return {
    overdue: sum(open.filter((p) => p.plannedDate < today).map((p) => p.amount)),
    next7: sum(open.filter((p) => inRange(p.plannedDate, week)).map((p) => p.amount)),
    month: sum(open.filter((p) => inRange(p.plannedDate, month)).map((p) => p.amount)),
    total: sum(open.map((p) => p.amount)),
    totalCount: open.length,
    reserved: sum(loans.filter((l) => !l.archived).map((l) => l.reserved)),
    shortfall: round2(shortfall),
    perDay,
  }
}

export const totalDebt = (loans: Loan[]): number => sum(loans.filter((l) => !l.archived).map((l) => l.balance ?? 0))

export function repaidAmount(loan: Loan): number | null {
  if (loan.initialAmount === undefined || loan.balance === undefined) return null
  return Math.max(0, round2(loan.initialAmount - loan.balance))
}

export function repaidPercent(loan: Loan): number | null {
  const r = repaidAmount(loan)
  if (r === null || !loan.initialAmount) return null
  return Math.min(100, Math.max(0, (r / loan.initialAmount) * 100))
}

/** Ориентировочная часть платежа, идущая в основной долг (если известны ставка и остаток). */
export function suggestPrincipal(loan: Loan, amount: number): number {
  if (loan.balance === undefined) return 0
  if (loan.rate && loan.rate > 0) {
    const interest = (loan.balance * loan.rate) / 100 / 12
    return Math.min(loan.balance, Math.max(0, round2(amount - interest)))
  }
  return Math.min(loan.balance, amount)
}

export interface PayoffEstimate { months: number; totalInterest: number; finalDate: string; assumptions: string[] }

/** Срок и переплата — ТОЛЬКО при известных остатке, ставке и платеже; предположения показываются пользователю. */
export function estimatePayoff(loan: Loan): PayoffEstimate | { error: string } {
  if (loan.balance === undefined || loan.balance <= 0) return { error: 'Нужен текущий остаток долга.' }
  if (loan.rate === undefined) return { error: 'Укажите процентную ставку — без неё переплату рассчитать нельзя.' }
  if (loan.monthlyPayment <= 0) return { error: 'Укажите размер ежемесячного платежа.' }
  const monthlyRate = loan.rate / 100 / 12
  let bal = loan.balance
  let interest = 0
  let months = 0
  while (bal > 0.005 && months < 600) {
    const i = bal * monthlyRate
    if (loan.monthlyPayment <= i + 0.005) return { error: 'Платёж меньше начисляемых процентов — долг не уменьшается. Проверьте данные.' }
    interest += i
    bal = bal + i - loan.monthlyPayment
    months++
  }
  return {
    months,
    totalInterest: round2(interest),
    finalDate: addMonthsClamp(loan.nextPaymentDate, months - 1, loan.paymentDay),
    assumptions: [
      'Аннуитетная схема: проценты начисляются раз в месяц на остаток (ставка ÷ 12).',
      'Платёж постоянный и вносится вовремя, без досрочных погашений.',
      'Комиссии и страховки не учитываются. Реальный график банка может отличаться.',
    ],
  }
}

/** Динамика долга по концам месяцев: от текущего остатка назад, прибавляя погашенные суммы основного долга. */
export function debtSeries(loans: Loan[], payments: LoanPayment[], months: string[]): { month: string; debt: number }[] {
  const active = loans.filter((l) => !l.archived && l.balance !== undefined)
  const ids = new Set(active.map((l) => l.id))
  const paid = payments.filter((p) => p.status === 'paid' && p.paidDate && ids.has(p.loanId))
  const now = totalDebt(active)
  const today = todayStr()
  return months.map((m) => {
    const end = monthEnd(m)
    const cutoff = end > today ? today : end
    const after = sum(paid.filter((p) => p.paidDate! > cutoff).map((p) => p.principalPaid ?? 0))
    return { month: m, debt: round2(now + after) }
  })
}
