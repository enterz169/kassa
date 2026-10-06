import { db } from './db'
import type { ShiftStatus, ShiftTemplate } from '../types'

/**
 * «Шаблон» — это сам статус дня. Заполнили данные в статусе один раз (время, ставка…) —
 * они запоминаются в нём и подставляются при следующем выборе этого статуса.
 * Ключ: ключ статуса ('work', 'dayoff', …) или 'custom:<название>' для своих статусов.
 * Чаевые не запоминаются — они каждый раз разные.
 */
export const presetKey = (status: ShiftStatus, label?: string) => (status === 'custom' ? `custom:${(label ?? '').trim().toLowerCase()}` : status === 'planned' ? 'work' : status)

export type PresetInput = Omit<ShiftTemplate, 'id' | 'createdAt' | 'name'> & { label?: string }

export async function savePreset(p: PresetInput): Promise<void> {
  const status = p.status === 'planned' ? 'work' : p.status
  const name = presetKey(status, p.customLabel)
  if (status === 'custom' && !p.customLabel?.trim()) return
  const row = { ...p, status, name, tips: 0 } as Omit<ShiftTemplate, 'id' | 'createdAt'>
  await db.transaction('rw', db.templates, async () => {
    const prev = await db.templates.filter((t) => t.name === name).first()
    if (prev) await db.templates.put({ ...prev, ...row, id: prev.id })
    else await db.templates.add({ ...row, createdAt: Date.now() })
  })
}

export const deletePreset = (id: number) => db.templates.delete(id)
