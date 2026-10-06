import { missingPeriods, nextPaymentOf } from '../lib/calc/loans'
import { round2 } from '../lib/money'
import { todayStr } from '../lib/dates'
import { db } from './db'
import type { Loan, LoanPayment } from '../types'

export type LoanInput = Omit<Loan, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }

async function syncLoanNext(loanId: number): Promise<void> {
  const loan = await db.loans.get(loanId)
  if (!loan) return
  const payments = await db.loanPayments.where('loanId').equals(loanId).toArray()
  const next = nextPaymentOf(loanId, payments)
  if (next && next.plannedDate !== loan.nextPaymentDate) await db.loans.update(loanId, { nextPaymentDate: next.plannedDate })
}

/** Достраивает график платежей; существующие периоды не дублируются (плюс уникальный индекс в БД). */
export async function ensureSchedule(loanId: number, useAnchor = false): Promise<number> {
  return db.transaction('rw', db.loans, db.loanPayments, async () => {
    const loan = await db.loans.get(loanId)
    if (!loan || loan.archived) return 0
    const payments = await db.loanPayments.where('loanId').equals(loanId).toArray()
    const missing = missingPeriods(loan, payments, todayStr(), undefined, useAnchor)
    let added = 0
    for (const m of missing) {
      const exists = await db.loanPayments.where('[loanId+periodKey]').equals([loanId, m.periodKey]).first()
      if (exists) continue
      await db.loanPayments.add({ loanId, periodKey: m.periodKey, originalDate: m.plannedDate, plannedDate: m.plannedDate, amount: m.amount, status: 'planned', createdAt: Date.now() })
      added++
    }
    await syncLoanNext(loanId)
    return added
  })
}

export async function ensureAllSchedules(): Promise<void> {
  for (const l of await db.loans.toArray()) if (l.id) await ensureSchedule(l.id)
}

export async function saveLoan(input: LoanInput, opts: { rebuildSchedule?: boolean } = {}): Promise<number> {
  const now = Date.now()
  const id = await db.transaction('rw', db.loans, db.loanPayments, async () => {
    if (input.id) {
      const prev = await db.loans.get(input.id)
      if (!prev) throw new Error('Кредит не найден.')
      await db.loans.put({ ...prev, ...input, id: input.id, updatedAt: now })
      if (opts.rebuildSchedule) await db.loanPayments.where('loanId').equals(input.id).filter((p) => p.status === 'planned').delete()
      return input.id
    }
    return (await db.loans.add({ ...input, createdAt: now, updatedAt: now })) as number
  })
  await ensureSchedule(id, !!opts.rebuildSchedule)
  return id
}

export async function deleteLoan(id: number): Promise<void> {
  await db.transaction('rw', db.loans, db.loanPayments, db.transactions, async () => {
    const ids = (await db.loanPayments.where('loanId').equals(id).toArray()).map((p) => p.id!)
    // совершённые расходы сохраняем как обычные записи — деньги были потрачены
    const linked = await db.transactions.where('loanPaymentId').anyOf(ids).toArray()
    await db.transactions.bulkPut(linked.map((t) => ({ ...t, loanPaymentId: undefined })))
    await db.loanPayments.bulkDelete(ids)
    await db.loans.delete(id)
  })
}

export const setReserved = (id: number, amount: number) => db.loans.update(id, { reserved: Math.max(0, round2(amount)), updatedAt: Date.now() })

export interface PaidInput { paymentId: number; paidDate: string; amount: number; principal: number; method?: string; comment?: string }

/**
 * Оплата: в одной транзакции статус → «оплачен», ровно один расход в категории «Кредиты»,
 * уменьшение остатка долга и резерва. Повторный вызов для оплаченного платежа ничего не делает.
 */
export async function markPaid(inp: PaidInput): Promise<void> {
  if (inp.paidDate > todayStr()) throw new Error('Дата оплаты не может быть в будущем.')
  if (!(inp.amount > 0)) throw new Error('Сумма платежа должна быть больше нуля.')
  let loanId = 0
  await db.transaction('rw', db.loans, db.loanPayments, db.transactions, db.categories, async () => {
    const p = await db.loanPayments.get(inp.paymentId)
    if (!p) throw new Error('Платёж не найден.')
    loanId = p.loanId
    if (p.status === 'paid') return
    const loan = await db.loans.get(p.loanId)
    if (!loan) throw new Error('Кредит не найден.')
    const cat = await db.categories.where('key').equals('loans').first()
    if (!cat?.id) throw new Error('Не найдена категория расходов «Кредиты».')
    const now = Date.now()
    const dup = await db.transactions.where('loanPaymentId').equals(inp.paymentId).first()
    let expenseId: number
    if (dup?.id) {
      expenseId = dup.id
      await db.transactions.update(expenseId, { amount: inp.amount, date: inp.paidDate, updatedAt: now })
    } else {
      expenseId = (await db.transactions.add({
        type: 'expense', amount: inp.amount, title: `Платёж: ${loan.name}`, categoryId: cat.id, date: inp.paidDate,
        method: inp.method, comment: inp.comment, loanPaymentId: inp.paymentId, createdAt: now, updatedAt: now,
      })) as number
    }
    const principal = loan.balance === undefined ? 0 : Math.min(loan.balance, Math.max(0, round2(inp.principal)))
    await db.loanPayments.update(inp.paymentId, { status: 'paid', paidDate: inp.paidDate, amount: inp.amount, principalPaid: principal, comment: inp.comment ?? p.comment, expenseId })
    await db.loans.update(loan.id!, {
      balance: loan.balance === undefined ? undefined : Math.max(0, round2(loan.balance - principal)),
      reserved: Math.max(0, round2(loan.reserved - inp.amount)),
      updatedAt: now,
    })
  })
  if (loanId) await ensureSchedule(loanId)
}

/** Отмена оплаты: убираем связанный расход и возвращаем остаток долга. */
export async function unmarkPaid(paymentId: number): Promise<void> {
  let loanId = 0
  await db.transaction('rw', db.loans, db.loanPayments, db.transactions, async () => {
    const p = await db.loanPayments.get(paymentId)
    if (!p || p.status !== 'paid') return
    loanId = p.loanId
    await db.transactions.where('loanPaymentId').equals(paymentId).delete()
    const loan = await db.loans.get(p.loanId)
    if (loan && loan.balance !== undefined && p.principalPaid) await db.loans.update(loan.id!, { balance: round2(loan.balance + p.principalPaid), updatedAt: Date.now() })
    await db.loanPayments.update(paymentId, { status: 'planned', paidDate: undefined, principalPaid: undefined, expenseId: undefined })
  })
  if (loanId) await syncLoanNext(loanId)
}

export interface PaymentPatch { plannedDate?: string; amount?: number; comment?: string }

/** Перенос/изменение суммы правит ту же запись — второй платёж не создаётся. */
export async function updatePayment(id: number, patch: PaymentPatch): Promise<void> {
  const p = await db.loanPayments.get(id)
  if (!p) throw new Error('Платёж не найден.')
  if (p.status === 'paid') throw new Error('Оплаченный платёж изменить нельзя — сначала отмените оплату.')
  const next: Partial<LoanPayment> = { ...patch }
  if ((patch.plannedDate && patch.plannedDate !== p.plannedDate) || (patch.amount !== undefined && patch.amount !== p.amount)) next.changed = true
  await db.loanPayments.update(id, next)
  await syncLoanNext(p.loanId)
}

export async function setPaymentCancelled(id: number, cancelled: boolean): Promise<void> {
  const p = await db.loanPayments.get(id)
  if (!p || p.status === 'paid') return
  await db.loanPayments.update(id, { status: cancelled ? 'cancelled' : 'planned' })
  await syncLoanNext(p.loanId)
}
