import { addMonths } from 'date-fns'
import { daysBetween, inRange, monthStart, parse, toStr } from '../dates'
import { fmtMoney, fmtPercent, daysWord } from '../money'
import { expenseIn, expensesByCategory, incomeIn, shiftStats, type IncomeEntry } from './finance'
import { pctChange } from './analytics'
import { paymentState, reserveInfo, openPayments } from './loans'
import type { Category, Loan, LoanPayment, Shift, Transaction } from '../../types'

export type InsightTone = 'good' | 'bad' | 'warn' | 'info'
export interface Insight { id: string; tone: InsightTone; text: string }

interface Ctx { today: string; shifts: Shift[]; entries: IncomeEntry[]; txs: Transaction[]; cats: Category[]; loans: Loan[]; payments: LoanPayment[] }

/** Выводы только на реальных данных; если базы для сравнения нет — вывод не показывается. */
export function buildInsights({ today, shifts, entries, txs, cats, loans, payments }: Ctx): Insight[] {
  const out: Insight[] = []
  const monthFrom = monthStart(today)
  const thisMonth = { from: monthFrom, to: today }

  const prevFrom = toStr(addMonths(parse(monthFrom), -1))
  const prevTo = toStr(addMonths(parse(today), -1))
  const prevSame = { from: prevFrom, to: prevTo >= prevFrom ? prevTo : prevFrom }
  const incNow = incomeIn(entries, thisMonth)
  const ch = pctChange(incNow, incomeIn(entries, prevSame))
  if (ch !== null && incNow > 0 && Math.abs(ch) >= 1) {
    out.push({ id: 'income-change', tone: ch >= 0 ? 'good' : 'warn', text: `С начала месяца вы заработали на ${fmtPercent(Math.abs(Math.round(ch)))} ${ch >= 0 ? 'больше' : 'меньше'}, чем за такой же период прошлого месяца.` })
  }

  const cat = expensesByCategory(txs, cats, thisMonth)
  const expCount = txs.filter((x) => x.type === 'expense' && inRange(x.date, thisMonth)).length
  if (cat.length >= 2 && expCount >= 3) {
    out.push({ id: 'top-category', tone: 'info', text: `На «${cat[0].name}» ушло ${fmtPercent(Math.round(cat[0].share))} расходов этого месяца (${fmtMoney(cat[0].amount)}).` })
  }

  const expNow = expenseIn(txs, thisMonth)
  if (incNow > 0 && expNow > incNow) {
    out.push({ id: 'overspend', tone: 'bad', text: `В этом месяце расходы (${fmtMoney(expNow)}) уже больше доходов (${fmtMoney(incNow)}).` })
  }

  const active = loans.filter((l) => !l.archived)
  const open = openPayments(payments).filter((p) => active.some((l) => l.id === p.loanId))
  const overdue = open.filter((p) => paymentState(p, today) === 'overdue')
  if (overdue.length) {
    out.push({ id: 'overdue', tone: 'bad', text: `Просрочено платежей: ${overdue.length} на ${fmtMoney(overdue.reduce((a, p) => a + p.amount, 0))}.` })
  }
  const next = open.find((p) => p.plannedDate >= today)
  if (next) {
    const d = daysBetween(today, next.plannedDate)
    const loan = active.find((l) => l.id === next.loanId)
    out.push({
      id: 'next-payment', tone: d <= 3 ? 'warn' : 'info',
      text: d === 0 ? `Платёж по «${loan?.name}» — сегодня (${fmtMoney(next.amount)}).` : `До ближайшего кредитного платежа осталось ${daysWord(d)} («${loan?.name}», ${fmtMoney(next.amount)}).`,
    })
    if (loan) {
      const info = reserveInfo(loan, payments, today)
      if (info.state === 'saving' && info.perDay) out.push({ id: 'save-per-day', tone: 'info', text: `Чтобы накопить на платёж вовремя, нужно откладывать примерно ${fmtMoney(info.perDay)} в день.` })
      else if (info.state === 'today') out.push({ id: 'save-today', tone: 'warn', text: `Платёж сегодня, а отложено меньше нужного — не хватает ${fmtMoney(info.left)}.` })
    }
  }

  const st = shiftStats(shifts, thisMonth)
  if (st.count >= 3) out.push({ id: 'avg-shift', tone: 'info', text: `Средний заработок за смену в этом месяце — ${fmtMoney(st.avgPerShift)}${st.avgRate > 0 ? ` (≈ ${fmtMoney(st.avgRate)} в час)` : ''}.` })

  const stale = shifts.filter((s) => s.status === 'planned' && s.date < today).length
  if (stale > 0) out.push({ id: 'stale-planned', tone: 'warn', text: `Есть прошедших запланированных смен без отметки: ${stale}. Пока они не учтены в доходе.` })

  return out
}
