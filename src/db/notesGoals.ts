import { db } from './db'
import type { Goal, Note } from '../types'

export type NoteInput = Omit<Note, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }

export async function saveNote(input: NoteInput): Promise<number> {
  const now = Date.now()
  if (input.id) {
    const prev = await db.notes.get(input.id)
    if (!prev) throw new Error('Заметка не найдена.')
    await db.notes.put({ ...prev, ...input, id: input.id, updatedAt: now })
    return input.id
  }
  return (await db.notes.add({ ...input, createdAt: now, updatedAt: now })) as number
}

export const deleteNote = (id: number) => db.notes.delete(id)

export async function toggleNotePin(id: number): Promise<void> {
  const n = await db.notes.get(id)
  if (n) await db.notes.update(id, { pinned: !n.pinned })
}

export type GoalInput = Omit<Goal, 'id' | 'createdAt'> & { id?: number }

export async function saveGoal(input: GoalInput): Promise<number> {
  if (input.id) {
    const prev = await db.goals.get(input.id)
    if (!prev) throw new Error('Цель не найдена.')
    await db.goals.put({ ...prev, ...input, id: input.id })
    return input.id
  }
  return (await db.goals.add({ ...input, createdAt: Date.now() })) as number
}

export const deleteGoal = (id: number) => db.goals.delete(id)

export const setGoalCompleted = (id: number, completed: boolean) => db.goals.update(id, { completed, completedAt: completed ? Date.now() : undefined })

export async function addToSaved(id: number, delta: number): Promise<void> {
  const g = await db.goals.get(id)
  if (g) await db.goals.update(id, { saved: Math.max(0, Math.round((g.saved + delta) * 100) / 100) })
}
