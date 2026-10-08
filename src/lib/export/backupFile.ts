import { exportBackup, markBackupDone } from '../../db/backup'
import { downloadBlob, type SaveResult } from './download'

export async function saveBackupFile(): Promise<SaveResult> {
  const data = await exportBackup()
  const r = await downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `kassa-backup-${new Date().toISOString().slice(0, 10)}.json`)
  if (r === 'saved') await markBackupDone()
  return r
}
