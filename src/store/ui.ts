import { create } from 'zustand'
import type { NoteLink, PageId, TxType } from '../types'

export type Sheet =
  | { kind: 'quick' }
  | { kind: 'import' }
  | { kind: 'shift'; date: string }
  | { kind: 'recurring'; date?: string }
  | { kind: 'multi'; dates: string[] }
  | { kind: 'tx'; type: TxType; id?: number }
  | { kind: 'loan'; id?: number }
  | { kind: 'loanDetail'; id: number }
  | { kind: 'payment'; id: number }
  | { kind: 'note'; id?: number; link?: NoteLink }
  | { kind: 'goal'; id?: number }
  | { kind: 'categories'; type: TxType }
  | { kind: 'drill'; title: string; categoryId?: number; from: string; to: string; txType?: TxType }

export interface Toast { id: number; tone: 'ok' | 'bad' | 'info'; text: string }

export interface ConfirmState {
  title: string
  text?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
}

export type MoneyTab = 'income' | 'expense' | 'balance'

interface UI {
  page: PageId
  moneyTab: MoneyTab
  moneyCategory: number | null
  sheet: Sheet | null
  toasts: Toast[]
  confirm: ConfirmState | null
  go: (p: PageId, opts?: { moneyTab?: MoneyTab; category?: number | null }) => void
  open: (s: Sheet) => void
  close: () => void
  toast: (text: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
  ask: (c: ConfirmState) => void
  closeConfirm: () => void
}

let seq = 1

export const useUI = create<UI>((set, get) => ({
  page: 'home', moneyTab: 'expense', moneyCategory: null, sheet: null, toasts: [], confirm: null,
  go: (page, opts) => {
    set({ page, sheet: null, moneyTab: opts?.moneyTab ?? get().moneyTab, moneyCategory: opts?.category === undefined ? null : opts.category })
    window.scrollTo({ top: 0 })
  },
  open: (sheet) => set({ sheet }),
  close: () => set({ sheet: null }),
  toast: (text, tone = 'ok') => {
    const id = seq++
    set((s) => ({ toasts: [...s.toasts, { id, tone, text }].slice(-3) }))
    setTimeout(() => get().dismissToast(id), tone === 'bad' ? 5200 : 3000)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  ask: (confirm) => set({ confirm }),
  closeConfirm: () => set({ confirm: null }),
}))

export const errText = (e: unknown): string => (e instanceof Error ? e.message : 'Что-то пошло не так. Попробуйте ещё раз.')
