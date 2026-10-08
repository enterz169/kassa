import { installPdfPolyfills } from './polyfills'
import type { Table } from './table'

/** Достаёт строки текста из PDF (pdf.js работает на устройстве, файл никуда не уходит). */
export async function readPdfLines(file: File): Promise<string[]> {
  installPdfPolyfills()
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { default: workerCode } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw')
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    try {
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(URL.createObjectURL(new Blob([`(${installPdfPolyfills.toString()})();\n`, workerCode], { type: 'text/javascript' })), { type: 'module' })
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

const DATE_START = /^\s*(\d{2}[.]\d{2}[.](?:\d{4}|\d{2})(?!\d))/
const DATE_ANY = /\d{2}\.\d{2}\.\d{2,4}/g
const TIME_ANY = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g
const MONEY = /([+\-−–]?)\s?(\d{1,3}(?:[  ]\d{3})*|\d+)[.,](\d{2})(?!\d)\s*(?:₽|руб\.?|RUB|RUR|р\.?|\$|€|USD|EUR)?/g
// шапки таблиц на каждой странице, подписи и итоги — не часть операции
const NOISE = /пополнени[яй]\s*:|расход[ыов]*\s*:|поступлени[яй]\s*:|списани[яй]\s*:|страниц|итого|остаток на|пополнени[яй] за|расходы за|всего|выписк|справка|реквизит|акционерн|\bбик\b|\bинн\b|лицензи|номер договора|движении средств|период|дата проводки|код операции|в валюте счета|уполномоченное лицо|подпись сотрудника|альфа-банк|ф\.и\.о|остаток средств|сумма операции|описание операции/i
/** В описании банки пишут сумму покупки («на сумму: 1214.00 RUR») — это не сумма операции со знаком. */
const EMBEDDED = /на сумму:?\s*[\d\s.,]+\s*(?:RUR|RUB|₽|руб\.?|USD|EUR|\$|€)?/gi
const CODE = /\b(?=[A-Za-z0-9_]*\d)[A-Za-z0-9_]{6,}\b/g

interface Raw { date: string; sign: '+' | '-' | ''; amount: number; desc: string; mcc: string }

function cleanDesc(src: string): string {
  let d = src
  const place = /место совершения операции:?\s*(.*)$/i.exec(d)
  if (place) {
    // «82129363\RU\MOSKVA\YANDEX 5814 EDA MCC3990» → «YANDEX EDA»
    const seg = place[1].split('\\')
    d = seg[seg.length - 1]
  } else {
    d = d.replace(/через систем\S*\s+быстрых\s+платежей/gi, 'по СБП').replace(/без ндс\.?/gi, ' ')
      .replace(/\+\s?7[\d\s()\-]{9,}\d\.?/g, ' ') // телефоны получателей в название не берём
  }
  d = d.replace(/[А-ЯЁA-Z]\.\s?[А-ЯЁA-Z]\.\s+[А-ЯЁ][а-яё\-]+/g, ' ') // подпись сотрудника банка
  if (/по СБП/.test(d) && /^(Перевод|Возврат)/.test(d)) d = d.replace(/\s+(на|от)\s*$/i, (m) => (/на/i.test(m) ? ' (исходящий)' : ' (входящий)'))
  return d.replace(/\bMCC\s?\d{4}\b/gi, ' ').replace(CODE, ' ').replace(/\b\d{4,}\b/g, ' ').replace(/\s+/g, ' ').replace(/^[\s\-–—,.;:]+|[\s\-–—,.;:]+$/g, '')
}

/** Строки выписки (Т-Банк, Сбер, Альфа и похожие) → таблица «Дата / Сумма / Описание / MCC». */
export function pdfLinesToTable(lines: string[]): Table {
  const blocks: string[][] = []
  const NAME_LINE = /^[А-ЯЁA-Z]\.\s?[А-ЯЁA-Z]\.\s+[А-ЯЁA-Za-z\-]+$/ // подпись «А.А. Фамилия»
  for (const l of lines) {
    if (DATE_START.test(l) || /^HOLD\b/.test(l)) blocks.push([l])
    else if (blocks.length && !NOISE.test(l) && !NAME_LINE.test(l)) blocks[blocks.length - 1].push(l)
  }
  const raws: Raw[] = []
  for (const b of blocks) {
    if (/^HOLD\b/.test(b[0])) continue // «неподтверждённая операция»: банк ещё не провёл её, она появится в следующей выписке
    const text = b.join(' ')
    // у карточных операций настоящая дата покупки указана в описании
    const real = /дата совершения операции:?\s*(\d{2}\.\d{2}\.\d{2,4})/i.exec(text)
    const date = real ? real[1] : DATE_START.exec(b[0])![1]
    const strip = (x: string) => x.replace(EMBEDDED, ' ').replace(DATE_ANY, ' ').replace(TIME_ANY, ' ')
    let tokens = [...strip(b[0]).matchAll(MONEY)]
    if (!tokens.length) tokens = [...strip(text).matchAll(MONEY)]
    if (!tokens.length) continue
    const t = tokens.find((x) => x[1]) ?? tokens[0] // сумма со знаком надёжнее остальных чисел строки
    const amount = Number(`${t[2].replace(/[  ]/g, '')}.${t[3]}`)
    if (!amount) continue
    const sign = t[1] === '+' ? '+' : t[1] ? '-' : ''
    const mcc = /\bMCC\s?(\d{4})\b/i.exec(text)?.[1] ?? ''
    raws.push({ date, sign, amount, desc: cleanDesc(strip(text).replace(MONEY, ' ')), mcc })
  }
  // Знак: Т-Банк и Сбер помечают приходы «+», Альфа помечает расходы «−». Числа без знака читаем по тому, какой знак встречается в документе.
  const hasPlus = raws.some((r) => r.sign === '+'); const hasMinus = raws.some((r) => r.sign === '-')
  const unsignedIsIncome = !hasPlus && hasMinus
  const rows: Table = [['Дата', 'Сумма', 'Описание', 'MCC']]
  for (const r of raws) {
    const income = r.sign === '+' || (r.sign === '' && unsignedIsIncome)
    rows.push([r.date, income ? r.amount : -r.amount, r.desc, r.mcc])
  }
  return rows
}
