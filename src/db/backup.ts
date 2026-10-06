import { db, TABLES, type TableName } from './db'
import { ensureSeed, updateSettings } from './settings'

export interface BackupFile { app: 'kassa'; version: 1; exportedAt: string; data: Record<TableName, unknown[]> }

export async function exportBackup(): Promise<BackupFile> {
  const data = {} as Record<TableName, unknown[]>
  for (const t of TABLES) data[t] = await db.table(t).toArray()
  return { app: 'kassa', version: 1, exportedAt: new Date().toISOString(), data }
}

export function validateBackup(raw: unknown): BackupFile {
  const f = raw as BackupFile
  if (!f || f.app !== 'kassa' || f.version !== 1 || typeof f.data !== 'object' || f.data === null) throw new Error('Это не файл резервной копии приложения.')
  // шаблоны появились позже — в старых копиях их может не быть
  if (!Array.isArray(f.data.templates)) f.data.templates = []
  for (const t of TABLES) if (!Array.isArray(f.data[t])) throw new Error(`В файле нет раздела «${t}» — копия повреждена.`)
  return f
}

/** Полная замена данных копией (одна транзакция: при ошибке ничего не меняется). */
export async function importBackup(raw: unknown): Promise<void> {
  const f = validateBackup(raw)
  await db.transaction('rw', db.tables, async () => {
    for (const t of TABLES) {
      const table = db.table(t)
      await table.clear()
      if (f.data[t].length) await table.bulkAdd(f.data[t])
    }
  })
  await ensureSeed()
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => { for (const t of TABLES) await db.table(t).clear() })
  await ensureSeed()
}

export const markBackupDone = () => updateSettings({ lastBackupAt: Date.now() })

export async function isUserDataEmpty(): Promise<boolean> {
  const c = await Promise.all([db.shifts.count(), db.transactions.count(), db.loans.count(), db.notes.count(), db.goals.count()])
  return c.every((x) => x === 0)
}
