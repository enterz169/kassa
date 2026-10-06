const nfInt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const nfFrac = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const nfPct = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

export function fmtMoney(n: number): string {
  const v = round2(n)
  const s = Number.isInteger(v) ? nfInt.format(v) : nfFrac.format(v)
  return `${s} ₽`
}

export function fmtSigned(n: number): string {
  const v = round2(n)
  if (v === 0) return fmtMoney(0)
  return `${v > 0 ? '+' : '−'}${fmtMoney(Math.abs(v))}`
}

export function fmtCompact(n: number): string {
  const v = Math.abs(n)
  if (v >= 1_000_000) return `${nfPct.format(n / 1_000_000)}м`
  if (v >= 1000) return `${nfPct.format(Math.round(n / 100) / 10)}к`
  return nfInt.format(Math.round(n))
}

export const fmtHours = (h: number): string => `${nfPct.format(round2(h))} ч`
export const fmtPercent = (p: number): string => `${nfPct.format(p)}%`
export const fmtNumber = (n: number): string => nfPct.format(n)

/** Разбор суммы из поля ввода: "1 500,5" → 1500.5. Пустая/неверная строка → null. */
export function parseMoney(input: string | number | undefined | null): number | null {
  if (input === undefined || input === null) return null
  if (typeof input === 'number') return Number.isFinite(input) ? round2(input) : null
  const s = input.replace(/[₽рРrR\s ]/g, '').replace(',', '.')
  if (s === '') return null
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? round2(n) : null
}

export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

export const daysWord = (n: number) => `${n} ${plural(n, ['день', 'дня', 'дней'])}`
