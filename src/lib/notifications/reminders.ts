import { daysBetween, fmtShort, todayStr } from '../dates'
import { daysWord, fmtMoney } from '../money'
import { openPayments } from '../calc/loans'
import type { Loan, LoanPayment } from '../../types'

export interface Reminder {
  key: string
  paymentId: number
  loanId: number
  loanName: string
  daysLeft: number
  level: 'overdue' | 'today' | 'soon' | 'info'
  title: string
  text: string
  /** срабатывает ли именно сегодня выбранный пользователем интервал (для всплывающих уведомлений) */
  fireToday: boolean
}

export function thresholds(l: Loan): number[] {
  if (!l.reminders.enabled) return []
  const t = [l.reminders.d7 && 7, l.reminders.d3 && 3, l.reminders.d1 && 1, l.reminders.d0 && 0, ...l.reminders.custom].filter((x): x is number => typeof x === 'number')
  return [...new Set(t)].sort((a, b) => b - a)
}

/**
 * Напоминания, видимые внутри приложения: за N дней и до оплаты платёж остаётся в списке;
 * просроченные показываются всегда, если напоминания кредита не выключены.
 */
export function computeReminders(loans: Loan[], payments: LoanPayment[], today = todayStr()): Reminder[] {
  const out: Reminder[] = []
  for (const loan of loans) {
    if (loan.archived || !loan.reminders.enabled) continue
    const th = thresholds(loan)
    for (const p of openPayments(payments, loan.id)) {
      const d = daysBetween(today, p.plannedDate)
      const sum = fmtMoney(p.amount)
      if (d < 0) {
        out.push({ key: `${p.id}:over`, paymentId: p.id!, loanId: loan.id!, loanName: loan.name, daysLeft: d, level: 'overdue', title: `Просрочен платёж: ${loan.name}`, text: `${sum}, срок был ${fmtShort(p.plannedDate)} (${daysWord(-d)} назад)`, fireToday: true })
      } else if (th.length && d <= th[0]) {
        out.push({
          key: `${p.id}:${d}`, paymentId: p.id!, loanId: loan.id!, loanName: loan.name, daysLeft: d,
          level: d === 0 ? 'today' : d <= 3 ? 'soon' : 'info',
          title: d === 0 ? `Платёж сегодня: ${loan.name}` : `Платёж через ${daysWord(d)}: ${loan.name}`,
          text: `${sum}, ${fmtShort(p.plannedDate)}`, fireToday: th.includes(d),
        })
      }
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft)
}
