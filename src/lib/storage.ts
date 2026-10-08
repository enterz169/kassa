/** Защита истории от очистки браузером: постоянное хранилище + контроль потери данных. */
export interface StorageInfo { supported: boolean; persisted: boolean; usedMb?: number; quotaMb?: number }

export async function storageInfo(): Promise<StorageInfo> {
  const s = typeof navigator !== 'undefined' ? navigator.storage : undefined
  if (!s?.persisted) return { supported: false, persisted: false }
  const persisted = await s.persisted().catch(() => false)
  const est = await s.estimate?.().catch(() => undefined)
  return { supported: true, persisted, usedMb: est?.usage ? est.usage / 1048576 : undefined, quotaMb: est?.quota ? est.quota / 1048576 : undefined }
}

/** Просим браузер не удалять данные при нехватке места. Браузер вправе отказать — тогда нужны копии. */
export async function requestPersistence(): Promise<boolean> {
  const s = typeof navigator !== 'undefined' ? navigator.storage : undefined
  if (!s?.persist) return false
  try { return (await s.persisted()) || (await s.persist()) } catch { return false }
}

const KEY = 'kassa-had-data'
export interface Counts { shifts: number; txs: number; loans: number }

/** Запоминаем, что данные были: если потом база окажется пустой — это потеря, а не первый запуск. */
export function rememberCounts(c: Counts): void {
  try { if (c.shifts + c.txs + c.loans > 0) localStorage.setItem(KEY, JSON.stringify({ ...c, at: Date.now() })) } catch { /* ignore */ }
}
export function readRemembered(): (Counts & { at: number }) | null {
  try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null } catch { return null }
}
export function forgetCounts(): void { try { localStorage.removeItem(KEY) } catch { /* ignore */ } }
