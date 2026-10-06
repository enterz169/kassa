import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import fontData from '../../assets/fonts/DejaVuSans.ttf?inline'
import { fmtDate } from '../dates'
import { fmtHours, fmtMoney, fmtPercent } from '../money'
import type { Report } from '../calc/analytics'
import { downloadBlob } from './download'

const FONT = 'DejaVu'

/** PDF с кириллицей: шрифт встроен в приложение. */
export function exportReportPdf(r: Report) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  doc.addFileToVFS('DejaVuSans.ttf', fontData.slice(fontData.indexOf(',') + 1))
  doc.addFont('DejaVuSans.ttf', FONT, 'normal')
  doc.addFont('DejaVuSans.ttf', FONT, 'bold')
  doc.setFont(FONT)

  const W = doc.internal.pageSize.getWidth()
  let y = 48
  doc.setFontSize(20)
  doc.text('Финансовый отчёт', 40, y)
  y += 20
  doc.setFontSize(11)
  doc.setTextColor(110)
  doc.text(`${fmtDate(r.range.from)} — ${fmtDate(r.range.to)}`, 40, y)
  doc.text(`Сформирован ${new Date().toLocaleDateString('ru-RU')}`, W - 40, y, { align: 'right' })
  doc.setTextColor(0)
  y += 16

  const common = { styles: { font: FONT, fontSize: 10, cellPadding: 5 }, headStyles: { font: FONT, fillColor: [255, 61, 127] as [number, number, number], textColor: 255 }, margin: { left: 40, right: 40 } }
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  const summary: [string, string][] = [
    ['Общий доход', fmtMoney(r.income)], ['  из них от смен', fmtMoney(r.shiftIncome)], ['  из других источников', fmtMoney(r.otherIncome)],
    ['Общие расходы (фактические)', fmtMoney(r.expense)], ['Чистый результат', fmtMoney(r.net)],
    ['Отработано смен', String(r.stats.count)], ['Отработано часов', fmtHours(r.stats.hours)], ['Средний доход за смену', fmtMoney(r.stats.avgPerShift)],
  ]
  if (r.prev) summary.push(['Доход за предыдущий период', fmtMoney(r.prev.income)], ['Расходы за предыдущий период', fmtMoney(r.prev.expense)], ['Результат за предыдущий период', fmtMoney(r.prev.net)])
  autoTable(doc, { ...common, startY: y, head: [['Показатель', 'Значение']], body: summary, columnStyles: { 1: { halign: 'right' } } })

  autoTable(doc, { ...common, startY: lastY() + 18, head: [['Расходы по категориям', 'Сумма', 'Доля', 'Записей']], body: r.byCategory.length ? r.byCategory.map((c) => [c.name, fmtMoney(c.amount), fmtPercent(Math.round(c.share * 10) / 10), String(c.count)]) : [['Нет расходов за период', '', '', '']], columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } } })

  autoTable(doc, { ...common, startY: lastY() + 18, head: [['Оплаченные кредитные платежи', 'Дата оплаты', 'Сумма']], body: [...(r.paid.length ? r.paid.map((p) => [p.loanName, fmtDate(p.paidDate!), fmtMoney(p.amount)]) : [['Нет оплат за период', '', '']]), ['Итого оплачено', '', fmtMoney(r.paidTotal)]], columnStyles: { 2: { halign: 'right' } } })

  autoTable(doc, { ...common, startY: lastY() + 18, head: [['Предстоящие платежи (не входят в расходы)', 'Плановая дата', 'Сумма']], body: [...(r.upcoming.length ? r.upcoming.map((p) => [p.loanName, fmtDate(p.plannedDate), fmtMoney(p.amount)]) : [['Нет предстоящих платежей', '', '']]), ['Итого предстоит', '', fmtMoney(r.upcomingTotal)]], columnStyles: { 2: { halign: 'right' } } })

  return downloadBlob(doc.output('blob'), `otchet_${r.range.from}_${r.range.to}.pdf`)
}
