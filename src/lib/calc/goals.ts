import { inRange } from '../dates'
import { round2 } from '../money'
import { expenseIn, incomeIn, sum, type IncomeEntry } from './finance'
import type { Goal, GoalType, Loan, Transaction } from '../../types'

export const GOAL_TYPES: Record<GoalType, { label: string; short: string; definition: string; needsPeriod: boolean }> = {
  earn: { label: 'Заработать', short: 'Заработок', needsPeriod: true, definition: 'Прогресс — весь доход за период: смены, чаевые, бонусы и другие поступления.' },
  save: { label: 'Накопить', short: 'Накопления', needsPeriod: false, definition: 'Прогресс — суммы, которые вы вносите в цель вручную. Доход и деньги на платежи сюда не входят.' },
  limit: { label: 'Не потратить больше', short: 'Лимит', needsPeriod: true, definition: 'Прогресс — фактические расходы за период, включая оплаченные кредитные платежи. Чем меньше, тем лучше.' },
  reserve: { label: 'Резерв на платежи', short: 'Резерв', needsPeriod: false, definition: 'Прогресс — сумма «отложено на платежи» по всем активным кредитам (раздел «Кредиты»). Это не оплаченный долг.' },
}

export interface GoalProgress { current: number; target: number; percent: number; left: number; over: boolean; done: boolean }

export function goalProgress(g: Goal, entries: IncomeEntry[], txs: Transaction[], loans: Loan[]): GoalProgress {
  let current = 0
  const r = g.periodStart && g.periodEnd ? { from: g.periodStart, to: g.periodEnd } : null
  if (g.type === 'earn') current = r ? incomeIn(entries, r) : sum(entries.map((e) => e.amount))
  else if (g.type === 'limit') current = r ? expenseIn(txs, r) : sum(txs.filter((t) => t.type === 'expense').map((t) => t.amount))
  else if (g.type === 'save') current = g.saved
  else current = sum(loans.filter((l) => !l.archived).map((l) => l.reserved))
  const percent = g.target > 0 ? (current / g.target) * 100 : 0
  const over = g.type === 'limit' && current > g.target
  const done = g.completed || (g.type !== 'limit' && current >= g.target)
  return { current: round2(current), target: g.target, percent, left: Math.max(0, round2(g.target - current)), over, done }
}

export const goalInPeriod = (g: Goal, today: string): boolean => !g.periodStart || !g.periodEnd || inRange(today, { from: g.periodStart, to: g.periodEnd })
