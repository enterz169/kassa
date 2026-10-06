import { addDaysStr, addMonthsClamp, monthStart, parse, todayStr } from '../lib/dates'
import { DEFAULT_REMINDERS } from '../lib/constants'
import { calcHours } from '../lib/calc/shifts'
import { db } from './db'
import { markPaid, saveLoan, setReserved } from './loans'
import { updateSettings } from './settings'
import type { Shift } from '../types'

/** Демо-данные для знакомства. Добавляются только в пустую базу. */
export async function loadDemoData(): Promise<void> {
  const today = todayStr()
  const now = Date.now()
  await updateSettings({ defaultRate: 500, defaultStart: '09:00', defaultEnd: '19:00', defaultBreak: 60 })

  const shifts: Omit<Shift, 'id'>[] = []
  for (let i = -35; i <= 14; i++) {
    if ((i + 35) % 4 > 1) continue
    const past = i <= 0
    shifts.push({
      date: addDaysStr(today, i), status: past ? 'work' : 'planned', start: '09:00', end: '19:00', breakMin: 60,
      hours: calcHours('09:00', '19:00', 60) ?? 9, payMode: 'hourly', rate: 500, fixedPay: 0, manualTotal: 0,
      tips: past ? [0, 500, 1000, 700, 300][Math.abs(i) % 5] : 0, bonus: past && Math.abs(i) % 7 === 0 ? 500 : 0, extra: 0,
      seriesId: 'demo-2-2', createdAt: now, updatedAt: now,
    })
  }
  await db.shifts.bulkAdd(shifts as never)

  const cats = await db.categories.toArray()
  const cat = (key: string) => cats.find((c) => c.key === key)!.id!
  const mk = (type: 'income' | 'expense', title: string, amount: number, key: string, daysAgo: number, method = 'Карта') => ({
    type, title, amount, categoryId: cat(key), date: addDaysStr(today, -daysAgo), method, createdAt: now, updatedAt: now,
  })
  await db.transactions.bulkAdd([
    mk('expense', 'Продукты', 2450, 'food', 1), mk('expense', 'Проезд', 780, 'transport', 2), mk('expense', 'Обед', 520, 'food', 3, 'Наличные'),
    mk('expense', 'Интернет', 650, 'internet', 5), mk('expense', 'Кино', 1200, 'fun', 6), mk('expense', 'Продукты', 3180, 'food', 9),
    mk('expense', 'Аренда', 18000, 'rent', 12), mk('expense', 'Подписка', 399, 'subs', 14), mk('expense', 'Куртка', 6900, 'clothes', 20),
    mk('expense', 'Аптека', 840, 'health', 24), mk('expense', 'Продукты', 2760, 'food', 31),
    mk('income', 'Подработка', 4500, 'side', 8), mk('income', 'Подарок', 3000, 'other_inc', 27),
  ] as never)

  const base = { reminders: { ...DEFAULT_REMINDERS }, reserved: 0, paymentDay: 15, color: '#ff3d7f', icon: 'credit-card' }
  const next1 = addDaysStr(today, 8)
  const loan1 = await saveLoan({ ...base, name: 'Кредитная карта', bank: 'Банк', initialAmount: 120000, balance: 91000, monthlyPayment: 9000, rate: 24, openDate: addMonthsClamp(today, -8, 15), nextPaymentDate: next1, paymentDay: parse(next1).getDate() })
  const next2 = addDaysStr(today, 20)
  await saveLoan({ ...base, name: 'Рассрочка на телефон', bank: 'Магазин', initialAmount: 60000, balance: 30000, monthlyPayment: 5000, rate: 0, nextPaymentDate: next2, paymentDay: parse(next2).getDate(), color: '#ff7a1a', icon: 'smartphone' })

  // оплаченный платёж в прошлом — для истории и динамики долга
  const pastDate = addDaysStr(today, -20)
  const pastId = (await db.loanPayments.add({ loanId: loan1, periodKey: addMonthsClamp(today, -3, 1).slice(0, 7), originalDate: pastDate, plannedDate: pastDate, amount: 9000, status: 'planned', createdAt: now })) as number
  await markPaid({ paymentId: pastId, paidDate: pastDate, amount: 9000, principal: 7000 })
  await setReserved(loan1, 6000)

  const m0 = monthStart(today)
  const mEnd = addDaysStr(addMonthsClamp(m0, 1, 1), -1)
  await db.notes.add({ title: 'Идея', text: 'Откладывать по 1 000 ₽ после каждой смены на кредитный платёж.', pinned: true, createdAt: now, updatedAt: now })
  await db.goals.bulkAdd([
    { title: 'Заработать за месяц', type: 'earn', target: 100000, periodStart: m0, periodEnd: mEnd, saved: 0, completed: false, createdAt: now },
    { title: 'Подушка безопасности', type: 'save', target: 100000, saved: 15000, completed: false, createdAt: now },
    { title: 'Лимит расходов за месяц', type: 'limit', target: 50000, periodStart: m0, periodEnd: mEnd, saved: 0, completed: false, createdAt: now },
  ] as never)
}
