// Все даты хранятся строками 'yyyy-MM-dd' (локальное время), время — 'HH:mm'.

export type ShiftStatus = 'work' | 'planned' | 'dayoff' | 'holiday' | 'sick' | 'vacation' | 'custom'
export type PayMode = 'hourly' | 'fixed' | 'manual'

export interface Shift {
  id?: number
  date: string
  status: ShiftStatus
  customLabel?: string
  color?: string
  start?: string
  end?: string
  breakMin: number
  hours: number
  payMode: PayMode
  rate: number
  fixedPay: number
  manualTotal: number
  tips: number
  bonus: number
  extra: number
  note?: string
  seriesId?: string
  createdAt: number
  updatedAt: number
}

export type TxType = 'income' | 'expense'

export interface Transaction {
  id?: number
  type: TxType
  amount: number
  title: string
  categoryId: number
  date: string
  method?: string
  comment?: string
  note?: string
  loanPaymentId?: number
  /** Ключ строки банковской выписки — защита от повторного импорта. */
  importKey?: string
  createdAt: number
  updatedAt: number
}

export interface Category {
  id?: number
  kind: TxType
  name: string
  color: string
  key?: string
  system?: boolean
}

export interface LoanReminders {
  enabled: boolean
  d7: boolean
  d3: boolean
  d1: boolean
  d0: boolean
  custom: number[]
}

export interface Loan {
  id?: number
  name: string
  bank?: string
  initialAmount?: number
  balance?: number
  totalToRepay?: number
  openDate?: string
  nextPaymentDate: string
  monthlyPayment: number
  rate?: number
  endDate?: string
  paymentDay: number
  comment?: string
  color: string
  icon: string
  reserved: number
  reminders: LoanReminders
  archived?: boolean
  createdAt: number
  updatedAt: number
}

export type PaymentStatus = 'planned' | 'paid' | 'cancelled'

export interface LoanPayment {
  id?: number
  loanId: number
  /** 'yyyy-MM' — период графика; уникален в паре с loanId (защита от дублей) */
  periodKey: string
  originalDate: string
  plannedDate: string
  amount: number
  status: PaymentStatus
  paidDate?: string
  principalPaid?: number
  comment?: string
  changed?: boolean
  expenseId?: number
  createdAt: number
}

export type PaymentState = 'paid' | 'cancelled' | 'overdue' | 'soon' | 'upcoming'

export type NoteLink =
  | { type: 'day'; date: string }
  | { type: 'shift'; refId: number; date: string }
  | { type: 'transaction'; refId: number }
  | { type: 'loan'; refId: number }

export interface Note {
  id?: number
  title: string
  text: string
  pinned: boolean
  link?: NoteLink
  createdAt: number
  updatedAt: number
}

export type GoalType = 'earn' | 'save' | 'limit' | 'reserve'

export interface Goal {
  id?: number
  title: string
  type: GoalType
  target: number
  periodStart?: string
  periodEnd?: string
  saved: number
  completed: boolean
  completedAt?: number
  createdAt: number
}

export interface Settings {
  id: 1
  userName: string
  defaultRate: number
  defaultBreak: number
  defaultStart: string
  defaultEnd: string
  defaultPayMode: PayMode
  openingBalance: number
  remindTime: string
  theme?: ThemeSettings
  lastBackupAt?: number
  createdAt: number
}

export type PageId = 'home' | 'calendar' | 'money' | 'loans' | 'analytics' | 'notes' | 'goals' | 'settings' | 'more'

/** Шаблон смены: один раз заполненные ставка, время, чаевые и т. д. — применяется к любому дню одним нажатием. */
export interface ShiftTemplate {
  id?: number
  name: string
  color: string
  status: ShiftStatus
  customLabel?: string
  start?: string
  end?: string
  breakMin: number
  payMode: PayMode
  rate: number
  fixedPay: number
  manualTotal: number
  tips: number
  bonus: number
  extra: number
  createdAt: number
}

export type HomeBlock = 'hero' | 'reminders' | 'stats' | 'insights' | 'chart' | 'lists'
export type BgKind = 'dark' | 'graphite' | 'amoled' | 'navy'

/** Внешний вид: цвета акцента, фон, скругление, размер, свечение и порядок блоков главной. */
export interface ThemeSettings {
  accent: string
  colors: [string, string, string]
  bg: BgKind
  radius: 'sharp' | 'normal' | 'round'
  scale: 'sm' | 'md' | 'lg'
  glow: boolean
  order: HomeBlock[]
  hidden: HomeBlock[]
}
