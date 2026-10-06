import { db } from './db'
import type { Shift } from '../types'

export type ShiftInput = Omit<Shift, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }

/** Выходной, отпуск, больничный и т. п. — без часов и денег. */
export function normalizeShift<T extends ShiftInput>(i: T): T {
  if (i.status === 'work' || i.status === 'planned') return i
  return { ...i, start: undefined, end: undefined, breakMin: 0, hours: 0, rate: 0, fixedPay: 0, manualTotal: 0, tips: 0, bonus: 0, extra: 0 }
}

/** Одна запись на день: один и тот же заработок нельзя посчитать дважды. */
export async function saveShift(raw: ShiftInput): Promise<number> {
  const input = normalizeShift(raw)
  const now = Date.now()
  return db.transaction('rw', db.shifts, async () => {
    const same = await db.shifts.where('date').equals(input.date).first()
    if (same && same.id !== input.id) throw new Error('На эту дату запись уже есть — откройте её и измените.')
    if (input.id) {
      const prev = await db.shifts.get(input.id)
      if (!prev) throw new Error('Запись не найдена.')
      await db.shifts.put({ ...prev, ...input, id: input.id, updatedAt: now })
      return input.id
    }
    return (await db.shifts.add({ ...input, createdAt: now, updatedAt: now })) as number
  })
}

export const deleteShift = (id: number) => db.shifts.delete(id)

/** Массовое создание (повторяющиеся смены). Уже занятые дни не затрагиваются. */
export async function createShiftsBulk(items: ShiftInput[]): Promise<{ created: number; skipped: number }> {
  const now = Date.now()
  return db.transaction('rw', db.shifts, async () => {
    const existing = new Set((await db.shifts.where('date').anyOf(items.map((i) => i.date)).toArray()).map((s) => s.date))
    const fresh = items.filter((i) => !existing.has(i.date)).map((i) => ({ ...normalizeShift(i), id: undefined, createdAt: now, updatedAt: now }))
    if (fresh.length) await db.shifts.bulkAdd(fresh as never)
    return { created: fresh.length, skipped: items.length - fresh.length }
  })
}

/** Удалить серию: только запланированные смены и выходные (отработанные и изменённые вручную не трогаем). */
export async function deleteSeriesPlanned(seriesId: string): Promise<number> {
  const rows = await db.shifts.where('seriesId').equals(seriesId).toArray()
  const ids = rows.filter((s) => s.status === 'planned' || s.status === 'dayoff').map((s) => s.id!)
  await db.shifts.bulkDelete(ids)
  return ids.length
}

export async function confirmPastPlanned(today: string): Promise<number> {
  const rows = await db.shifts.where('status').equals('planned').filter((s) => s.date <= today).toArray()
  const now = Date.now()
  await db.shifts.bulkPut(rows.map((s) => ({ ...s, status: 'work' as const, updatedAt: now })))
  return rows.length
}

/** Убрать записи у выбранных дней (для массовой очистки в календаре). */
export async function deleteShiftsOnDates(dates: string[]): Promise<number> {
  return db.transaction('rw', db.shifts, async () => db.shifts.where('date').anyOf(dates).delete())
}
