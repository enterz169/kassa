import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../lib/constants'
import { db } from './db'
import type { Settings } from '../types'

export const DEFAULT_SETTINGS: Settings = {
  id: 1, userName: '', defaultRate: 0, defaultBreak: 0, defaultStart: '09:00', defaultEnd: '18:00',
  defaultPayMode: 'hourly', openingBalance: 0, remindTime: '09:00', createdAt: Date.now(),
}

/** Первый запуск: настройки и стандартные категории. Повторный вызов безопасен. */
export async function ensureSeed(): Promise<void> {
  await db.transaction('rw', db.settings, db.categories, async () => {
    if (!(await db.settings.get(1))) await db.settings.put({ ...DEFAULT_SETTINGS, createdAt: Date.now() })
    const existing = await db.categories.toArray()
    const have = new Set(existing.map((c) => `${c.kind}:${c.key}`))
    const wanted = [...DEFAULT_INCOME_CATEGORIES, ...DEFAULT_EXPENSE_CATEGORIES]
    const toAdd = existing.length === 0 ? wanted : wanted.filter((c) => c.system && !have.has(`${c.kind}:${c.key}`))
    if (toAdd.length) await db.categories.bulkAdd(toAdd)
  })
}

export const getSettings = async (): Promise<Settings> => (await db.settings.get(1)) ?? { ...DEFAULT_SETTINGS }

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const cur = await getSettings()
  await db.settings.put({ ...cur, ...patch, id: 1 })
}
