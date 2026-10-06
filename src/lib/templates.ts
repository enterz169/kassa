import type { ShiftInput } from '../db/shifts'
import type { Settings, ShiftStatus, ShiftTemplate } from '../types'
import { calcHours } from './calc/shifts'
import { SHIFT_STATUS } from './constants'

/** Сохранённые данные статуса или, если их ещё нет, значения по умолчанию из настроек. */
export function presetOf(templates: ShiftTemplate[], status: ShiftStatus, st: Settings, label?: string): ShiftTemplate {
  const s = status === 'planned' ? 'work' : status
  const key = s === 'custom' ? `custom:${(label ?? '').trim().toLowerCase()}` : s
  const found = templates.find((t) => t.name === key)
  if (found) return found
  const works = s === 'work'
  return {
    name: key, status: s, color: SHIFT_STATUS[s].color, customLabel: label,
    start: works ? st.defaultStart : undefined, end: works ? st.defaultEnd : undefined, breakMin: works ? st.defaultBreak : 0,
    payMode: st.defaultPayMode, rate: works ? st.defaultRate : 0, fixedPay: 0, manualTotal: 0, tips: 0, bonus: 0, extra: 0, createdAt: 0,
  }
}

export const hasPreset = (templates: ShiftTemplate[], status: ShiftStatus, label?: string) =>
  templates.some((t) => t.name === (status === 'custom' ? `custom:${(label ?? '').trim().toLowerCase()}` : status === 'planned' ? 'work' : status))

/** Смена из сохранённых данных статуса: рабочая в будущем становится запланированной (в доход не входит). */
export function shiftFromPreset(t: ShiftTemplate, date: string, today: string): ShiftInput {
  const works = t.status === 'work'
  const status: ShiftStatus = works && date > today ? 'planned' : t.status
  const hours = works ? calcHours(t.start, t.end, t.breakMin) ?? 0 : 0
  return {
    date, status,
    customLabel: t.status === 'custom' ? t.customLabel : undefined,
    color: t.status === 'custom' ? t.color : undefined,
    start: works ? t.start : undefined, end: works ? t.end : undefined,
    breakMin: works ? t.breakMin : 0, hours, payMode: t.payMode,
    rate: works ? t.rate : 0, fixedPay: works ? t.fixedPay : 0, manualTotal: works ? t.manualTotal : 0,
    tips: 0, bonus: works ? t.bonus : 0, extra: works ? t.extra : 0,
  }
}

export const presetColor = (t: ShiftTemplate) => (t.status === 'custom' ? t.color : SHIFT_STATUS[t.status].color)
