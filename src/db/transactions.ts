import { db } from './db'
import { unmarkPaid } from './loans'
import type { Category, Transaction } from '../types'

export type TxInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }

export async function saveTransaction(input: TxInput): Promise<number> {
  const now = Date.now()
  if (input.id) {
    const prev = await db.transactions.get(input.id)
    if (!prev) throw new Error('Запись не найдена.')
    if (prev.loanPaymentId) throw new Error('Эта запись создана оплатой кредита — измените платёж в разделе «Кредиты».')
    await db.transactions.put({ ...prev, ...input, id: input.id, updatedAt: now })
    return input.id
  }
  return (await db.transactions.add({ ...input, createdAt: now, updatedAt: now })) as number
}

/** Удаление расхода по платежу кредита возвращает платёж в «не оплачен» — иначе учёт разойдётся. */
export async function deleteTransaction(id: number): Promise<void> {
  const t = await db.transactions.get(id)
  if (!t) return
  if (t.loanPaymentId) { await unmarkPaid(t.loanPaymentId); return }
  await db.transactions.delete(id)
}

export async function addCategory(c: Omit<Category, 'id'>): Promise<number> {
  const name = c.name.trim()
  if (!name) throw new Error('Введите название категории.')
  const same = await db.categories.where('kind').equals(c.kind).filter((x) => x.name.toLowerCase() === name.toLowerCase()).first()
  if (same) throw new Error('Такая категория уже есть.')
  return (await db.categories.add({ ...c, name })) as number
}

export async function updateCategory(id: number, patch: Partial<Pick<Category, 'name' | 'color'>>): Promise<void> {
  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) throw new Error('Название не может быть пустым.')
    const cur = await db.categories.get(id)
    const dup = await db.categories.where('kind').equals(cur!.kind).filter((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase()).first()
    if (dup) throw new Error('Такая категория уже есть.')
    patch = { ...patch, name }
  }
  await db.categories.update(id, patch)
}

export const categoryUsage = (id: number) => db.transactions.where('categoryId').equals(id).count()

export async function deleteCategory(id: number): Promise<void> {
  const c = await db.categories.get(id)
  if (!c) return
  if (c.system) throw new Error('Эту категорию использует приложение — её можно переименовать, но не удалить.')
  if ((await categoryUsage(id)) > 0) throw new Error('Категория используется в записях. Сначала перенесите или удалите записи.')
  await db.categories.delete(id)
}

export interface ImportRow { date: string; amount: number; title: string; categoryId: number; key: string; comment?: string }

/** Импорт выписки: один раз, без дублей (ключ строки проверяется внутри транзакции). */
export async function importTransactions(rows: ImportRow[]): Promise<{ added: number; skipped: number }> {
  const now = Date.now()
  return db.transaction('rw', db.transactions, async () => {
    const have = new Set((await db.transactions.toArray()).map((t) => t.importKey).filter(Boolean) as string[])
    const fresh = rows.filter((r) => !have.has(r.key))
    if (fresh.length) {
      await db.transactions.bulkAdd(fresh.map((r) => ({
        type: 'expense' as const, amount: r.amount, title: r.title, categoryId: r.categoryId, date: r.date,
        method: 'Карта', comment: r.comment, importKey: r.key, createdAt: now, updatedAt: now,
      })))
    }
    return { added: fresh.length, skipped: rows.length - fresh.length }
  })
}
