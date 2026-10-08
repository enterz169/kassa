import { round2 } from '../money'
import type { Category, Transaction } from '../../types'
import type { Cell, Table } from './table'

export type ColRole = 'date' | 'amount' | 'debit' | 'credit' | 'desc' | 'category' | 'status' | 'card' | 'mcc' | 'none'
export interface Mapping { header: number; cols: Record<number, ColRole> }

export const ROLE_LABELS: Record<ColRole, string> = {
  date: 'Дата', amount: 'Сумма (± в одной колонке)', debit: 'Расход', credit: 'Приход', desc: 'Описание / магазин', category: 'Категория банка', status: 'Статус', card: 'Карта', mcc: 'MCC (код магазина)', none: 'Не использовать',
}

const norm = (c: Cell) => String(c ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()

/** Роль колонки по заголовку. Порядок важен: «дата операции» лучше «даты платежа», «сумма операции» лучше «суммы платежа». */
function roleOf(h: string): { role: ColRole; score: number } {
  if (!h) return { role: 'none', score: 0 }
  if (/^дата (операции|транзакции|совершения)|^дата и время|^дата операции/.test(h)) return { role: 'date', score: 3 }
  if (/^дата( |$)/.test(h) && !/платеж|списан|обработ/.test(h)) return { role: 'date', score: 2 }
  if (/дата/.test(h)) return { role: 'date', score: 1 }
  if (/^(расход|списание|дебет|сумма списания|выдача)/.test(h)) return { role: 'debit', score: 3 }
  if (/^(приход|поступление|зачисление|кредит$|сумма зачисления)/.test(h)) return { role: 'credit', score: 3 }
  if (/^сумма (операции|в валюте операции)/.test(h)) return { role: 'amount', score: 3 }
  if (/^сумма( платежа| в рублях)?$|^сумма в |^итого$/.test(h)) return { role: 'amount', score: 2 }
  if (/сумма/.test(h) && !/кэшбэк|кешбэк|бонус|комисс/.test(h)) return { role: 'amount', score: 1 }
  if (/^(описание|назначение|контрагент|получатель|наименование|детали|операция|merchant|место)/.test(h)) return { role: 'desc', score: 3 }
  if (/описание|назначение|контрагент|магазин|получатель/.test(h)) return { role: 'desc', score: 2 }
  if (/^(mcc|мсс)( |$)|код категории/.test(h)) return { role: 'mcc', score: 3 }
  if (/^категория/.test(h)) return { role: 'category', score: 2 }
  if (/^статус/.test(h)) return { role: 'status', score: 2 }
  if (/номер карты|^карта/.test(h)) return { role: 'card', score: 2 }
  return { role: 'none', score: 0 }
}

/** Находит строку заголовка и роли колонок. */
export function detectMapping(t: Table): Mapping | null {
  for (let i = 0; i < Math.min(t.length, 25); i++) {
    const cells = t[i].map(norm)
    if (cells.filter(Boolean).length < 3) continue
    const best = new Map<ColRole, { idx: number; score: number }>()
    cells.forEach((h, idx) => {
      const { role, score } = roleOf(h)
      if (role === 'none') return
      const cur = best.get(role)
      if (!cur || score > cur.score) best.set(role, { idx, score })
    })
    const hasMoney = best.has('amount') || best.has('debit')
    if (best.has('date') && hasMoney) {
      const cols: Record<number, ColRole> = {}
      for (const [role, { idx }] of best) cols[idx] = role
      if (!best.has('desc')) {
        // запасной вариант: первая текстовая колонка после заголовка без роли
        const next = t[i + 1] ?? []
        const idx = next.findIndex((c, k) => cols[k] === undefined && typeof c === 'string' && /[а-яa-z]{3}/i.test(c))
        if (idx >= 0) cols[idx] = 'desc'
      }
      return { header: i, cols }
    }
  }
  return null
}

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function parseDate(c: Cell): string | null {
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? null : ymd(c)
  if (typeof c === 'number' && c > 20000 && c < 80000) return ymd(new Date(Math.round((c - 25569) * 86400000) + new Date().getTimezoneOffset() * 60000))
  const s = String(c ?? '').trim()
  let m = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/.exec(s)
  if (m) { const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return valid(y, Number(m[2]), Number(m[1])) }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return valid(Number(m[1]), Number(m[2]), Number(m[3]))
  return null
}
const valid = (y: number, mo: number, d: number) => (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(mo)}-${pad(d)}` : null)

/** «−1 234,50», «(450)», «450.00 RUB» → число со знаком. */
export function parseAmount(c: Cell): number | null {
  if (typeof c === 'number') return Number.isFinite(c) ? c : null
  let s = String(c ?? '').trim()
  if (!s) return null
  let neg = false
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1) }
  if (/[−–—-]/.test(s.replace(/[\d\s.,]+$/, '').slice(0, 3)) || /^[−–—-]/.test(s)) neg = true
  s = s.replace(/[^\d.,]/g, '')
  if (!s) return null
  const lc = s.lastIndexOf(','); const ld = s.lastIndexOf('.')
  const dec = Math.max(lc, ld)
  if (dec >= 0 && s.length - dec - 1 <= 2) s = s.slice(0, dec).replace(/[.,]/g, '') + '.' + s.slice(dec + 1)
  else s = s.replace(/[.,]/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? (neg ? -n : n) : null
}

export type RowKind = 'ok' | 'dup' | 'maybe' | 'loan' | 'income' | 'failed'
export interface Candidate {
  key: string
  date: string
  amount: number
  kind: 'expense' | 'income'
  title: string
  bankCat?: string
  card?: string
  state: RowKind
  categoryId: number
  selected: boolean
}

const LOAN_RE = /кредит|погашение|займ|ипотек|рассрочк|платеж по договор/i
const SELF_RE = /между своими|между счетами|собственн.* счет|перевод себе|внутренн.* перевод/i

const KEYWORDS: [RegExp, string][] = [
  [/pyat[ey]+rochk|pyatyorochk|magnit|perekrestok|lenta|auchan|dixy|vkusvill|samokat|sbermarket|yandex.?(eda|lavka|market)|chizhik|bristol|пятерочк|магнит|перекресток|перекрёсток|лента|ашан|дикси|вкусвилл|spar|окей|азбука вкуса|самокат|яндекс.?лавка|delivery club|продукт|супермаркет|гипермаркет|chizhik|чижик|бристоль|красное.?белое|fix ?price|sber ?samo|samokat|krasnoe|beloe|bulochn|pekarn|bakery|khleb|hleb|булочн|пекарн|хлеб|рыба|мясо|овощи|фрукт/i, 'food'],
  [/yandex.?(go|taxi)|uber|citymobil|gett|metro|rzd|azs|lukoil|gazprom|такси|яндекс.?go|uber|bolt|метро|метрополитен|ржд|аэрофлот|трансп|парков|азс|лукойл|газпромнефть|роснефть|shell|тройка|автобус|каршеринг|делимобил/i, 'transport'],
  [/аптек|клиник|медицин|стомат|врач|лаборатор|invitro|инвитро|здоров/i, 'health'],
  [/kfc|mcdonald|burger.?king|vkusno|dodo|starbucks|shokoladnitsa|kofemania|coffee|cafe|restoran|kinopoisk|steam|кино|театр|концерт|игр|steam|playstation|развлеч|бар |ресторан|кафе|кофе|coffee|burger|kfc|макдоналдс|mcdonald|вкусно|додо|dodo|суши|пицц|starbucks|шоколадниц/i, 'fun'],
  [/netflix|spotify|подписк|яндекс.?плюс|ivi|okko|кинопоиск|youtube|apple\.com|icloud|google (one|play)|телеграм|telegram premium|vpn/i, 'subs'],
  [/одежд|zara|h&m|lamoda|ламода|спортмастер|обув|uniqlo|befree|gloria|твое/i, 'clothes'],
  [/wildberries|ozon|aliexpress|lamoda|dns|mvideo|leroy|ikea|wildberries|вайлдберриз|ozon|озон|aliexpress|алиэкспресс|market|маркет|dns|м\.?видео|эльдорадо|леруа|ikea|икеа|детск|товар|магазин/i, 'shopping'],
  [/мтс|билайн|мегафон|теле2|tele2|связь|мобильн|yota/i, 'phone'],
  [/интернет|ростелеком|дом\.?ру|провайдер/i, 'internet'],
  [/жкх|жку|коммунал|электроэнерг|мосэнерго|газ |водоканал|квартплат|мособлеирц|отоплен/i, 'utilities'],
  [/аренд|найм/i, 'rent'],
  [/курс|школ|универс|образован|skillbox|гикбрейнс|stepik|udemy/i, 'edu'],
]

/** MCC — код вида магазина, который банк присваивает операции. Надёжнее названия. */
function mccCategory(mcc: number): string | undefined {
  if ([5411, 5422, 5441, 5451, 5462, 5499, 5300, 5921].includes(mcc)) return 'food'
  if ([5811, 5812, 5813, 5814, 5815, 5816, 5817, 5818, 7832, 7841, 7922, 7929, 7932, 7933, 7991, 7996, 7997, 7998, 7999, 5735, 5941, 5945, 5947].includes(mcc)) return mcc >= 5815 && mcc <= 5818 ? 'subs' : 'fun'
  if ((mcc >= 4111 && mcc <= 4131) || [4784, 4789, 5511, 5521, 5531, 5532, 5533, 5541, 5542, 5551, 5571, 7523, 7531, 7538, 7542, 7549, 4011, 4112, 3000].includes(mcc) || (mcc >= 3000 && mcc <= 3299) || (mcc >= 4511 && mcc <= 4582)) return 'transport'
  if ((mcc >= 8011 && mcc <= 8099) || [5122, 5912, 5975, 5976, 8071, 8099].includes(mcc)) return 'health'
  if ((mcc >= 5611 && mcc <= 5699) || [5948, 5949, 7251, 7296].includes(mcc)) return 'clothes'
  if ([4814, 4815, 4816, 4821].includes(mcc)) return 'phone'
  if ([4899, 4900].includes(mcc)) return mcc === 4899 ? 'internet' : 'utilities'
  if ((mcc >= 8211 && mcc <= 8299) || mcc === 8351) return 'edu'
  if ([6513].includes(mcc)) return 'rent'
  if ([5200, 5211, 5231, 5251, 5261, 5309, 5310, 5311, 5331, 5399, 5651, 5712, 5713, 5714, 5719, 5722, 5732, 5733, 5734, 5942, 5943, 5944, 5946, 5992, 5993, 5994, 5995, 5999, 5964, 5965, 5966, 5967, 5969, 4816].includes(mcc)) return 'shopping'
  return undefined
}

const BANK_CAT: [RegExp, string][] = [
  [/супермаркет|продукт|еда/i, 'food'], [/транспорт|такси|авто|азс|топливо/i, 'transport'], [/аптек|медицин|здоров/i, 'health'],
  [/кафе|ресторан|развлеч|кино|фастфуд|досуг/i, 'fun'], [/одежд|обувь/i, 'clothes'], [/связь|мобильн/i, 'phone'], [/подписк/i, 'subs'],
  [/жкх|коммунал/i, 'utilities'], [/образован/i, 'edu'], [/маркетплейс|покупк|товар|магазин|дом|ремонт/i, 'shopping'], [/кредит|займ/i, 'loans'],
]

export const normTitle = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[\d*#№]+/g, ' ').replace(/\s+/g, ' ').trim()

export function cleanTitle(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/^(оплата (товаров и услуг|покупки)|покупка)[:,. ]*/i, '').replace(/^card\d+\s*/i, '').trim().slice(0, 80) || 'Операция по карте'
}

function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export interface BuildOpts {
  table: Table
  mapping: Mapping
  cats: Category[]
  existing: Transaction[]
}

/** Строки выписки → кандидаты в расходы/доходы с категорией и пометкой о возможных дублях. */
export function buildCandidates({ table, mapping, cats, existing }: BuildOpts): Candidate[] {
  const roleIdx = (r: ColRole) => Number(Object.keys(mapping.cols).find((k) => mapping.cols[Number(k)] === r) ?? -1)
  const iDate = roleIdx('date'); const iAmt = roleIdx('amount'); const iDeb = roleIdx('debit'); const iCred = roleIdx('credit')
  const iMcc = roleIdx('mcc'); const iDesc = roleIdx('desc'); const iCat = roleIdx('category'); const iSt = roleIdx('status'); const iCard = roleIdx('card')

  const byKey = (k: string) => cats.find((c) => c.kind === 'expense' && c.key === k)
  const other = byKey('other_exp') ?? cats.find((c) => c.kind === 'expense')!
  const loans = byKey('loans')
  const learned = new Map<string, number>() // название → категория из ваших прошлых записей (новые важнее)
  for (const t of [...existing].filter((x) => x.type === 'expense').sort((a, b) => a.date.localeCompare(b.date))) learned.set(normTitle(t.title), t.categoryId)

  const seenKeys = new Set(existing.map((t) => t.importKey).filter(Boolean) as string[])
  const manual = existing.filter((t) => t.type === 'expense' && !t.loanPaymentId)
  const counter = new Map<string, number>()
  const out: Candidate[] = []

  for (let r = mapping.header + 1; r < table.length; r++) {
    const row = table[r]
    const date = parseDate(row[iDate])
    if (!date) continue
    let signed: number | null = null
    if (iAmt >= 0) signed = parseAmount(row[iAmt])
    else {
      const d = iDeb >= 0 ? parseAmount(row[iDeb]) : null
      const c = iCred >= 0 ? parseAmount(row[iCred]) : null
      signed = d ? -Math.abs(d) : c ? Math.abs(c) : null
    }
    if (!signed) continue
    const amount = round2(Math.abs(signed))
    const kind: 'expense' | 'income' = signed < 0 ? 'expense' : 'income'
    const rawDesc = iDesc >= 0 ? String(row[iDesc] ?? '') : ''
    const bankCat = iCat >= 0 ? String(row[iCat] ?? '').trim() || undefined : undefined
    const status = iSt >= 0 ? norm(row[iSt]) : ''
    const card = iCard >= 0 ? String(row[iCard] ?? '').replace(/\D/g, '').slice(-4) || undefined : undefined
    const title = cleanTitle(rawDesc || bankCat || '')

    const base = `${date}|${signed}|${normTitle(rawDesc)}|${card ?? ''}`
    const n = (counter.get(base) ?? 0) + 1
    counter.set(base, n)
    const key = `${hash(base)}-${n}`

    let state: RowKind = 'ok'
    let categoryId = other.id!
    if (kind === 'income') state = 'income'
    else {
      const nt = normTitle(rawDesc)
      const byLearn = learned.get(nt) ?? learned.get(normTitle(title))
      const mccNum = iMcc >= 0 ? Number(String(row[iMcc] ?? '').replace(/\D/g, '')) : 0
      const byMcc = mccNum ? mccCategory(mccNum) : undefined
      const byKw = KEYWORDS.find(([re]) => re.test(rawDesc))?.[1]
      const byBank = bankCat ? BANK_CAT.find(([re]) => re.test(bankCat))?.[1] : undefined
      const k = byKw === 'food' ? byKw : byMcc ?? byKw ?? byBank
      if (byLearn) categoryId = byLearn
      else if (k && byKey(k)) categoryId = byKey(k)!.id!
      if (LOAN_RE.test(rawDesc) || LOAN_RE.test(bankCat ?? '') || (loans && categoryId === loans.id)) { state = 'loan'; if (loans) categoryId = loans.id! }
      else if (SELF_RE.test(rawDesc)) state = 'income' // перевод между своими: расходом не считаем
    }
    if (/отклон|ошибк|failed|отмен/.test(status)) state = 'failed'
    if (seenKeys.has(key)) state = 'dup'
    else if (kind === 'expense' && state === 'ok' && manual.some((t) => t.date === date && Math.abs(t.amount - amount) < 0.005)) state = 'maybe'

    out.push({ key, date, amount, kind, title, bankCat, card, state, categoryId, selected: state === 'ok' })
  }
  return out
}
