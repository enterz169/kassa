import type { Category, PayMode, ShiftStatus } from '../types'

export interface StatusMeta { label: string; short: string; color: string }

export const SHIFT_STATUS: Record<ShiftStatus, StatusMeta> = {
  work: { label: 'Рабочая смена', short: 'Смена', color: '#34d399' },
  planned: { label: 'Запланированная смена', short: 'План', color: '#60a5fa' },
  dayoff: { label: 'Выходной', short: 'Выходной', color: '#94a3b8' },
  holiday: { label: 'Нерабочий день', short: 'Нерабочий', color: '#a78bfa' },
  sick: { label: 'Больничный', short: 'Больничный', color: '#fb7185' },
  vacation: { label: 'Отпуск', short: 'Отпуск', color: '#fbbf24' },
  custom: { label: 'Свой статус', short: 'Свой', color: '#f472b6' },
}

export const STATUS_ORDER: ShiftStatus[] = ['work', 'planned', 'dayoff', 'holiday', 'sick', 'vacation', 'custom']

export const PAY_MODES: Record<PayMode, { label: string; hint: string }> = {
  hourly: { label: 'Почасовая', hint: 'часы × ставка' },
  fixed: { label: 'За смену', hint: 'фиксированная оплата' },
  manual: { label: 'Итого вручную', hint: 'сумма уже включает всё' },
}

export const PAYMENT_METHODS = ['Карта', 'Наличные', 'СБП / перевод', 'Другое']

export const DEFAULT_EXPENSE_CATEGORIES: Omit<Category, 'id'>[] = [
  { kind: 'expense', name: 'Продукты', color: '#34d399', key: 'food' },
  { kind: 'expense', name: 'Жильё и аренда', color: '#60a5fa', key: 'rent' },
  { kind: 'expense', name: 'Интернет', color: '#22d3ee', key: 'internet' },
  { kind: 'expense', name: 'Телефон', color: '#818cf8', key: 'phone' },
  { kind: 'expense', name: 'Транспорт', color: '#fbbf24', key: 'transport' },
  { kind: 'expense', name: 'Медицина', color: '#fb7185', key: 'health' },
  { kind: 'expense', name: 'Одежда', color: '#f472b6', key: 'clothes' },
  { kind: 'expense', name: 'Развлечения', color: '#c084fc', key: 'fun' },
  { kind: 'expense', name: 'Подписки', color: '#a78bfa', key: 'subs' },
  { kind: 'expense', name: 'Покупки', color: '#fb923c', key: 'shopping' },
  { kind: 'expense', name: 'Образование', color: '#2dd4bf', key: 'edu' },
  { kind: 'expense', name: 'Кредиты', color: '#ff3d7f', key: 'loans', system: true },
  { kind: 'expense', name: 'Коммунальные услуги', color: '#38bdf8', key: 'utilities' },
  { kind: 'expense', name: 'Другое', color: '#9c9ca8', key: 'other_exp' },
]

export const DEFAULT_INCOME_CATEGORIES: Omit<Category, 'id'>[] = [
  { kind: 'income', name: 'Зарплата', color: '#34d399', key: 'salary' },
  { kind: 'income', name: 'Смены', color: '#60a5fa', key: 'shift', system: true },
  { kind: 'income', name: 'Чаевые', color: '#fbbf24', key: 'tips', system: true },
  { kind: 'income', name: 'Бонусы', color: '#ff7a1a', key: 'bonus', system: true },
  { kind: 'income', name: 'Подработка', color: '#c084fc', key: 'side', system: true },
  { kind: 'income', name: 'Другие доходы', color: '#9c9ca8', key: 'other_inc' },
]

export const CATEGORY_COLORS = ['#34d399', '#22d3ee', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#f472b6', '#ff3d7f', '#fb7185', '#fb923c', '#ff7a1a', '#fbbf24']
export const LOAN_COLORS = ['#ff3d7f', '#ff7a1a', '#fbbf24', '#34d399', '#22d3ee', '#60a5fa', '#a78bfa', '#c084fc']
export const LOAN_ICONS = ['landmark', 'credit-card', 'car', 'home', 'shopping-bag', 'graduation-cap', 'smartphone', 'wallet'] as const

export const DEFAULT_REMINDERS = { enabled: true, d7: false, d3: true, d1: true, d0: true, custom: [] as number[] }

export const CHART = { income: '#34d399', expense: '#ff5a7a', grid: 'rgba(255,255,255,0.06)', axis: '#6c6c78', blue: '#60a5fa', orange: '#ff7a1a', purple: '#a53df0' }
