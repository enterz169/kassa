export type SaveResult = 'saved' | 'declined' | 'failed'

interface ClaudeDownloads { save(r: { filename: string; data: Blob }): Promise<{ status: string }> }
declare global {
  interface Window { claude?: { use?: (name: string) => Promise<unknown> } }
}

/**
 * Сохранение файла. Внутри артефакта браузерное скачивание заблокировано, поэтому используется
 * возможность `downloads` (зритель подтверждает сохранение). Вне артефакта — обычная ссылка со скачиванием.
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<SaveResult> {
  try {
    const dl = (await window.claude?.use?.('downloads')) as ClaudeDownloads | null | undefined
    if (dl) {
      try { await dl.save({ filename, data: blob }); return 'saved' } catch (e) {
        return (e as { code?: string })?.code === 'declined' ? 'declined' : 'failed'
      }
    }
  } catch { /* среда без возможностей — обычное скачивание */ }
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.rel = 'noopener'
    document.body.appendChild(a); a.click(); a.remove()
    return 'saved'
  } catch { return 'failed' } finally { setTimeout(() => URL.revokeObjectURL(url), 60_000) }
}

export function reportSave(r: SaveResult, toast: (t: string, tone?: 'ok' | 'bad' | 'info') => void, okText = 'Файл сохранён') {
  if (r === 'saved') toast(okText)
  else if (r === 'failed') toast('Не удалось сохранить файл: браузер или окно блокирует скачивание', 'bad')
}
