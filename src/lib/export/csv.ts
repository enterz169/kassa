import { fmtDate } from '../dates'
import type { Report } from '../calc/analytics'
import type { Category, Transaction } from '../../types'
import { downloadBlob } from './download'

const esc = (v: string | number): string => {
  const s = String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const num = (n: number): string => String(n).replace('.', ',')

/** CSV для Excel (разделитель «;», числа с запятой, BOM для кириллицы). */
export function reportToCsv(r: Report): string {
  const rows: (string | number)[][] = []
  rows.push(['Финансовый отчёт', `${fmtDate(r.range.from)} — ${fmtDate(r.range.to)}`])
  rows.push([])
  rows.push(['Показатель', 'Значение'])
  rows.push(['Общий доход', num(r.income)], ['Доход от смен', num(r.shiftIncome)], ['Другие доходы', num(r.otherIncome)])
  rows.push(['Общие расходы (фактические)', num(r.expense)], ['Чистый результат', num(r.net)])
  rows.push(['Отработано смен', r.stats.count], ['Отработано часов', num(r.stats.hours)], ['Средний доход за смену', num(r.stats.avgPerShift)])
  if (r.prev) rows.push(['Доход за предыдущий период', num(r.prev.income)], ['Расходы за предыдущий период', num(r.prev.expense)], ['Результат за предыдущий период', num(r.prev.net)])
  rows.push([])
  rows.push(['Расходы по категориям'], ['Категория', 'Сумма', 'Доля, %', 'Записей'])
  for (const c of r.byCategory) rows.push([c.name, num(c.amount), num(Math.round(c.share * 10) / 10), c.count])
  rows.push([])
  rows.push(['Оплаченные кредитные платежи'], ['Кредит', 'Дата оплаты', 'Сумма'])
  for (const p of r.paid) rows.push([p.loanName, fmtDate(p.paidDate!), num(p.amount)])
  rows.push(['Итого оплачено', '', num(r.paidTotal)])
  rows.push([])
  rows.push(['Предстоящие платежи (не входят в расходы)'], ['Кредит', 'Плановая дата', 'Сумма'])
  for (const p of r.upcoming) rows.push([p.loanName, fmtDate(p.plannedDate), num(p.amount)])
  rows.push(['Итого предстоит', '', num(r.upcomingTotal)])
  return '﻿' + rows.map((row) => row.map(esc).join(';')).join('\r\n')
}

export function exportReportCsv(r: Report) {
  return downloadBlob(new Blob([reportToCsv(r)], { type: 'text/csv;charset=utf-8' }), `otchet_${r.range.from}_${r.range.to}.csv`)
}

export function exportTransactionsCsv(txs: Transaction[], cats: Category[], name: string) {
  const by = new Map(cats.map((c) => [c.id, c.name]))
  const rows = [['Дата', 'Тип', 'Название', 'Категория', 'Сумма', 'Способ оплаты', 'Комментарий'], ...txs.map((t) => [t.date, t.type === 'income' ? 'Доход' : 'Расход', t.title, by.get(t.categoryId) ?? '', num(t.amount), t.method ?? '', t.comment ?? ''])]
  return downloadBlob(new Blob(['﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), name)
}
