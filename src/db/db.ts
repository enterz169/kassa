import Dexie, { type EntityTable } from 'dexie'
import type { Category, Goal, Loan, LoanPayment, Note, Settings, Shift, ShiftTemplate, Transaction } from '../types'

export type FinanceDB = Dexie & {
  shifts: EntityTable<Shift, 'id'>
  transactions: EntityTable<Transaction, 'id'>
  categories: EntityTable<Category, 'id'>
  loans: EntityTable<Loan, 'id'>
  loanPayments: EntityTable<LoanPayment, 'id'>
  notes: EntityTable<Note, 'id'>
  goals: EntityTable<Goal, 'id'>
  settings: EntityTable<Settings, 'id'>
  templates: EntityTable<ShiftTemplate, 'id'>
}

export const db = new Dexie('kassa-finance') as FinanceDB

db.version(1).stores({
  shifts: '++id, &date, status, seriesId',
  transactions: '++id, type, categoryId, date, loanPaymentId',
  categories: '++id, kind, key',
  loans: '++id',
  // уникальная пара (кредит + период): база не даст создать два платежа за один месяц
  loanPayments: '++id, loanId, plannedDate, status, &[loanId+periodKey]',
  notes: '++id, pinned, updatedAt',
  goals: '++id, type, completed',
  settings: 'id',
})

db.version(2).stores({ templates: '++id' })

// v3: у выходных, отпусков и т. п. не бывает заработка — чистим старые записи с суммами.
db.version(3).stores({}).upgrade((tx) =>
  tx.table('shifts').toCollection().modify((s: Shift) => {
    if (s.status !== 'work' && s.status !== 'planned') Object.assign(s, { start: undefined, end: undefined, breakMin: 0, hours: 0, rate: 0, fixedPay: 0, manualTotal: 0, tips: 0, bonus: 0, extra: 0 })
  }))

export const TABLES = ['shifts', 'transactions', 'categories', 'loans', 'loanPayments', 'notes', 'goals', 'settings', 'templates'] as const
export type TableName = (typeof TABLES)[number]
