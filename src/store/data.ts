import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db/db'
import { buildIncomeEntries } from '../lib/calc/finance'
import { todayStr } from '../lib/dates'
import type { Category, Goal, Loan, LoanPayment, Note, Settings, Shift, ShiftTemplate, Transaction } from '../types'

export interface AppData {
  ready: boolean
  today: string
  shifts: Shift[]
  txs: Transaction[]
  cats: Category[]
  loans: Loan[]
  payments: LoanPayment[]
  notes: Note[]
  goals: Goal[]
  settings: Settings | undefined
  templates: ShiftTemplate[]
  entries: ReturnType<typeof buildIncomeEntries>
  catById: Map<number, Category>
  loanById: Map<number, Loan>
}

const EMPTY: never[] = []

/** Единый живой источник данных: любое изменение в IndexedDB мгновенно обновляет все экраны. */
export function useData(): AppData {
  const shifts = useLiveQuery(() => db.shifts.toArray(), [])
  const txs = useLiveQuery(() => db.transactions.toArray(), [])
  const cats = useLiveQuery(() => db.categories.toArray(), [])
  const loans = useLiveQuery(() => db.loans.toArray(), [])
  const payments = useLiveQuery(() => db.loanPayments.toArray(), [])
  const notes = useLiveQuery(() => db.notes.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const settings = useLiveQuery(() => db.settings.get(1), [])
  const templates = useLiveQuery(() => db.templates.toArray(), [])

  const ready = !!(shifts && txs && cats && loans && payments && notes && goals && settings)
  const S = shifts ?? EMPTY
  const T = txs ?? EMPTY
  const C = cats ?? EMPTY
  const L = loans ?? EMPTY

  const entries = useMemo(() => buildIncomeEntries(S, T, C), [S, T, C])
  const catById = useMemo(() => new Map(C.map((c) => [c.id!, c])), [C])
  const loanById = useMemo(() => new Map(L.map((l) => [l.id!, l])), [L])

  return { ready, today: todayStr(), shifts: S, txs: T, cats: C, loans: L, payments: payments ?? EMPTY, notes: notes ?? EMPTY, goals: goals ?? EMPTY, settings, templates: templates ?? EMPTY, entries, catById, loanById }
}
