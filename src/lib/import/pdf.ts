import type { Table } from './table'

/** Достаёт строки текста из PDF (pdf.js работает на устройстве, файл никуда не уходит). */
export async function readPdfLines(file: File): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { default: workerCode } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw')
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    try {
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(URL.createObjectURL(new Blob([workerCode], { type: 'text/javascript' })), { type: 'module' })
    } catch {
      throw new Error('В этом окне нельзя прочитать PDF. Откройте установленное приложение (с иконки на экране «Домой») или выберите CSV/Excel.')
    }
  }
  let doc
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  } catch (e) {
    const n = (e as { name?: string })?.name
    if (n === 'PasswordException') throw new Error('PDF защищён паролем. Сохраните выписку без пароля или выберите CSV/Excel.')
    throw new Error('Не удалось открыть PDF — файл повреждён или это не выписка.')
  }
  const lines: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const items = content.items
      .filter((i): i is typeof i & { str: string; transform: number[]; width: number } => 'str' in i && i.str.trim() !== '')
      .map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width }))
    // строки: близкие по высоте элементы — одна строка; сверху вниз, слева направо
    items.sort((a, b) => b.y - a.y || a.x - b.x)
    let cur: typeof items = []; let curY = Number.NaN
    const flush = () => {
      if (!cur.length) return
      cur.sort((a, b) => a.x - b.x)
      let line = ''; let prevEnd = Number.NaN
      for (const it of cur) { line += (line && it.x - prevEnd > 1.5 ? ' ' : line ? '' : '') + it.s; prevEnd = it.x + it.w }
      lines.push(line.replace(/\s+/g, ' ').trim())
      cur = []
    }
    for (const it of items) {
      if (Number.isNaN(curY) || Math.abs(it.y - curY) > 3) { flush(); curY = it.y }
      cur.push(it)
    }
    flush()
  }
  return lines
}

const DATE_START = /^\s*(\d{2}[.]\d{2}[.]\d{4})/
const DATE_ANY = /\d{2}\.\d{2}\.\d{2,4}/g
const TIME_ANY = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g
const MONEY = /([+\-−–]?)\s?(\d{1,3}(?:[  ]\d{3})*|\d+)[.,](\d{2})(?!\d)\s*(?:₽|руб\.?|RUB|р\.?|\$|€|USD|EUR)?/g
const NOISE = /пополнени[яй]\s*:|расход[ыов]*\s*:|поступлени[яй]\s*:|списани[яй]\s*:|страниц|итого|остаток на|пополнени[яй] за|расходы за|всего|выписк|справка|реквизит|акционерн|\bбик\b|\bинн\b|лицензи|номер договора|движении средств|период/i

/** Строки выписки (Т-Банк, Сбер и похожие) → таблица «Дата / Сумма / Описание». */
export function pdfLinesToTable(lines: string[]): Table {
  const blocks: string[] = []
  for (const l of lines) {
    if (DATE_START.test(l)) blocks.push(l)
    else if (blocks.length && !NOISE.test(l)) blocks[blocks.length - 1] += ' ' + l
  }
  const rows: Table = [['Дата', 'Сумма', 'Описание']]
  for (const b of blocks) {
    const date = DATE_START.exec(b)![1]
    const clean = b.replace(DATE_ANY, ' ').replace(TIME_ANY, ' ')
    const tokens = [...clean.matchAll(MONEY)]
    if (!tokens.length) continue
    const t = tokens[0]
    const amount = Number(`${t[2].replace(/[  ]/g, '')}.${t[3]}`)
    if (!amount) continue
    const signed = t[1] === '+' ? amount : -amount // без знака — расход; приходы банки помечают «+»
    const desc = clean.replace(MONEY, ' ').replace(/[*•]+\s?\d{4}\b/g, ' ').replace(/\b\d{4,}\b/g, ' ').replace(/\s+/g, ' ').replace(/^[\s\-–—,.;:]+|[\s\-–—,.;:]+$/g, '')
    rows.push([date, signed, desc])
  }
  return rows
}
