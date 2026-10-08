import { readSheet } from 'read-excel-file/browser'

export type Cell = string | number | Date | boolean | null | undefined
export type Table = Cell[][]

/** CSV с разделителем ; , или табуляцией, кавычками и переносами внутри ячеек. */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '')
  const head = t.split(/\r?\n/).slice(0, 8).join('\n')
  const count = (c: string) => (head.match(new RegExp(c === '\t' ? '\\t' : `\\${c}`, 'g')) ?? []).length
  const delim = [';', '\t', ',', '|'].map((c) => [c, count(c)] as const).sort((a, b) => b[1] - a[1])[0][0]
  const rows: string[][] = []
  let row: string[] = []; let cur = ''; let q = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c
    } else if (c === '"') q = true
    else if (c === delim) { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = [] }
    else cur += c
  }
  row.push(cur)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}

/** Банки отдают то UTF-8, то Windows-1251 — пробуем оба. */
export function decodeText(buf: ArrayBuffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf) } catch { return new TextDecoder('windows-1251').decode(buf) }
}

export async function readTable(file: File): Promise<Table> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx')) {
    const rows = (await readSheet(file)) as unknown as Table
    return rows.filter((r) => r.some((c) => c !== null && c !== undefined && String(c).trim() !== ''))
  }
  if (name.endsWith('.xls')) throw new Error('Старый формат .xls не поддерживается. В банке выберите CSV или XLSX, либо пересохраните файл в Excel как .xlsx.')
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const { readPdfLines, pdfLinesToTable } = await import('./pdf')
    const t = pdfLinesToTable(await readPdfLines(file))
    if (t.length < 2) throw new Error('В PDF не нашлось операций. Если это скан (фото), прочитать его нельзя — нужна выписка с текстом или CSV/Excel.')
    return t
  }
  return parseCsv(decodeText(await file.arrayBuffer()))
}
