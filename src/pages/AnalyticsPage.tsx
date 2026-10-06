import { Download, FileText, Lightbulb } from 'lucide-react'
import { useMemo } from 'react'
import { Avatar, PageHeader, Row, Stat, StatCard } from '../components/Common'
import { CompareBars, DebtChart, Donut, FlowChart, SingleBars } from '../components/charts/Charts'
import { PeriodPicker, usePeriod } from '../components/PeriodPicker'
import { Button } from '../components/ui/Button'
import { Card, Dot, Progress, SectionTitle } from '../components/ui/Card'
import { Notice } from '../components/ui/Feedback'
import { buildReport, pctChange } from '../lib/calc/analytics'
import { bucketsFor, GRAN_LABEL } from '../lib/calc/buckets'
import { dailySeries, expenseIn, incomeIn, shiftStats } from '../lib/calc/finance'
import { buildInsights } from '../lib/calc/insights'
import { debtSeries, isOpen, totalDebt } from '../lib/calc/loans'
import { exportReportCsv } from '../lib/export/csv'
import { exportReportPdf } from '../lib/export/pdf'
import { reportSave, type SaveResult } from '../lib/export/download'
import { addMonthsStr, eachMonth, fmtDate, fmtMonthShort, fmtShort, monthStart, rangeLabel, todayStr } from '../lib/dates'
import { fmtHours, fmtMoney, fmtPercent, fmtSigned } from '../lib/money'
import { useApp } from '../store/context'
import { errText, useUI } from '../store/ui'

const ANALYTICS_KEYS = ['week', 'month', 'quarter', 'halfyear', 'year', 'custom'] as const

export function AnalyticsPage() {
  const { shifts, txs, cats, loans, payments, entries, today } = useApp()
  const open = useUI((s) => s.open)
  const toast = useUI((s) => s.toast)
  const { state, setState, range } = usePeriod('month')

  const { granularity, list: buckets } = useMemo(() => bucketsFor(range), [range])
  const daily = useMemo(() => dailySeries(entries, txs, range), [entries, txs, range])
  const series = useMemo(() => buckets.map((b) => {
    const r = { from: b.from, to: b.to }
    const income = incomeIn(entries, r); const expense = expenseIn(txs, r); const st = shiftStats(shifts, r)
    return { ...b, income, expense, net: Math.round((income - expense) * 100) / 100, shifts: st.count, hours: st.hours, earned: st.earned, avg: st.avgPerShift }
  }), [buckets, entries, txs, shifts])

  const report = useMemo(() => buildReport(range, shifts, txs, cats, loans, payments, today), [range, shifts, txs, cats, loans, payments, today])
  const insights = useMemo(() => buildInsights({ today, shifts, entries, txs, cats, loans, payments }), [today, shifts, entries, txs, cats, loans, payments])

  const upcomingByMonth = useMemo(() => {
    const months = eachMonth({ from: monthStart(today), to: addMonthsStr(monthStart(today), 5) })
    return months.map((m) => ({ label: fmtMonthShort(m), value: payments.filter((p) => isOpen(p) && p.plannedDate.slice(0, 7) === m.slice(0, 7) && !loans.find((l) => l.id === p.loanId)?.archived).reduce((a, p) => a + p.amount, 0) }))
  }, [payments, loans, today])
  const debtMonths = useMemo(() => eachMonth({ from: addMonthsStr(monthStart(today), -5), to: monthStart(today) }), [today])
  const debt = useMemo(() => debtSeries(loans, payments, debtMonths).map((d) => ({ label: fmtMonthShort(d.month), debt: d.debt })), [loans, payments, debtMonths])
  const hasDebtData = loans.some((l) => !l.archived && l.balance !== undefined)

  const drillDay = (key?: string) => { if (key) open({ kind: 'drill', title: `Расходы: ${fmtDate(key)}`, from: key, to: key }) }
  const drillBucket = (key?: string) => { const b = buckets.find((x) => x.key === key); if (b) open({ kind: 'drill', title: 'Расходы', from: b.from, to: b.to }) }
  const empty = report.income === 0 && report.expense === 0 && report.stats.count === 0

  const run = async (fn: () => Promise<SaveResult>) => { try { reportSave(await fn(), toast, 'Файл сохранён') } catch (e) { toast(errText(e), 'bad') } }
  const inc = pctChange(report.income, report.prev?.income ?? 0)
  const exp = pctChange(report.expense, report.prev?.expense ?? 0)
  const tickEvery = daily.length > 45 ? 14 : daily.length > 20 ? 4 : daily.length > 10 ? 2 : 1

  return (
    <>
      <PageHeader title="Аналитика" sub={rangeLabel(range)} />
      <div className="mb-5"><PeriodPicker state={state} onChange={setState} keys={[...ANALYTICS_KEYS]} /></div>

      {insights.length > 0 && <div className="mb-5 grid gap-2 lg:grid-cols-2">{insights.slice(0, 4).map((i) => <Notice key={i.id} tone={i.tone === 'good' ? 'good' : i.tone === 'bad' ? 'bad' : i.tone === 'warn' ? 'warn' : 'info'}><span className="mr-1.5 inline-block align-[-2px]"><Lightbulb className="size-4" /></span>{i.text}</Notice>)}</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Доходы" value={fmtMoney(report.income)} tone="ok" sub={inc !== null ? `${inc >= 0 ? '▲' : '▼'} ${fmtPercent(Math.abs(Math.round(inc)))} к прошлому периоду` : undefined} />
        <StatCard label="Расходы" value={fmtMoney(report.expense)} sub={exp !== null ? `${exp >= 0 ? '▲' : '▼'} ${fmtPercent(Math.abs(Math.round(exp)))} к прошлому периоду` : undefined} />
        <StatCard label="Чистый результат" value={fmtSigned(report.net)} tone={report.net >= 0 ? 'ok' : 'bad'} />
        <StatCard label="Смен / часов" value={`${report.stats.count} / ${report.stats.hours}`} />
        <StatCard label="Средний за смену" value={report.stats.count ? fmtMoney(report.stats.avgPerShift) : '—'} />
        <StatCard label="Средняя ставка в час" value={report.stats.avgRate > 0 ? fmtMoney(report.stats.avgRate) : '—'} sub="заработок ÷ часы" />
        <StatCard label="Доход со смен" value={fmtMoney(report.shiftIncome)} />
        <StatCard label="Другие доходы" value={fmtMoney(report.otherIncome)} />
      </div>

      {empty ? (
        <Card className="py-10 text-center text-sm text-muted">За выбранный период данных нет — графики появятся, как только вы добавите смены или расходы.</Card>
      ) : (
        <div className="space-y-5">
          <Card>
            <SectionTitle>Доходы и расходы по дням</SectionTitle>
            <FlowChart data={daily.map((d) => ({ label: fmtShort(d.date), income: d.income, expense: d.expense, key: d.date }))} tickEvery={tickEvery} />
          </Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card><SectionTitle>Доходы по дням</SectionTitle><SingleBars data={daily.map((d) => ({ label: fmtShort(d.date), value: d.income, key: d.date }))} color="#34d399" name="Доход" /></Card>
            <Card><SectionTitle>Расходы по дням <span className="ml-1 text-xs font-normal text-faint">нажмите на столбец</span></SectionTitle><SingleBars data={daily.map((d) => ({ label: fmtShort(d.date), value: d.expense, key: d.date }))} color="#ff5a7a" name="Расход" onBarClick={drillDay} /></Card>
          </div>
          <Card>
            <SectionTitle>Сравнение доходов и расходов <span className="ml-1 text-xs font-normal text-faint">{GRAN_LABEL[granularity]}</span></SectionTitle>
            <CompareBars data={series.map((s) => ({ label: s.label, income: s.income, expense: s.expense, net: s.net }))} />
          </Card>

          <Card>
            <SectionTitle>Расходы по категориям</SectionTitle>
            {report.byCategory.length === 0 ? <p className="py-8 text-center text-sm text-muted">Расходов за период нет.</p> : (
              <div className="grid items-center gap-6 md:grid-cols-[220px_1fr]">
                <Donut slices={report.byCategory} size={210} center={<><span className="text-xs text-muted">расходы</span><span className="text-lg font-extrabold tabular-nums">{fmtMoney(report.expense)}</span></>} onSliceClick={(id) => open({ kind: 'drill', title: report.byCategory.find((c) => c.categoryId === id)?.name ?? 'Категория', categoryId: id, from: range.from, to: range.to })} />
                <div className="space-y-1">
                  {report.byCategory.map((c) => (
                    <button key={c.categoryId} onClick={() => open({ kind: 'drill', title: c.name, categoryId: c.categoryId, from: range.from, to: range.to })} className="block w-full rounded-xl p-2 text-left transition hover:bg-white/5">
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[14px]"><span className="flex min-w-0 items-center gap-2"><Dot color={c.color} /><span className="truncate">{c.name}</span></span><span className="shrink-0 tabular-nums"><b>{fmtMoney(c.amount)}</b> <span className="text-muted">· {fmtPercent(Math.round(c.share * 10) / 10)}</span></span></div>
                      <Progress value={c.share} color={c.color} height={5} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card><SectionTitle>Заработок <span className="ml-1 text-xs font-normal text-faint">{GRAN_LABEL[granularity]}</span></SectionTitle><SingleBars data={series.map((s) => ({ label: s.label, value: s.income, key: s.key }))} color="#60a5fa" name="Заработано" /></Card>
            <Card><SectionTitle>Чистый результат <span className="ml-1 text-xs font-normal text-faint">{GRAN_LABEL[granularity]}</span></SectionTitle><SingleBars data={series.map((s) => ({ label: s.label, value: s.net, key: s.key }))} color="#fbbf24" name="Результат" onBarClick={drillBucket} /></Card>
            <Card><SectionTitle>Количество смен</SectionTitle><SingleBars data={series.map((s) => ({ label: s.label, value: s.shifts }))} color="#a78bfa" name="Смен" format={(v) => String(v)} /></Card>
            <Card><SectionTitle>Отработанные часы</SectionTitle><SingleBars data={series.map((s) => ({ label: s.label, value: s.hours }))} color="#22d3ee" name="Часов" format={(v) => fmtHours(v)} /></Card>
            <Card className="lg:col-span-2"><SectionTitle>Средний заработок за смену</SectionTitle><SingleBars data={series.map((s) => ({ label: s.label, value: s.avg }))} color="#ff7a1a" name="За смену" /></Card>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle>Предстоящие кредитные платежи</SectionTitle>
          {upcomingByMonth.every((m) => m.value === 0) ? <p className="py-8 text-center text-sm text-muted">Предстоящих платежей на ближайшие 6 месяцев нет.</p> : <SingleBars data={upcomingByMonth} color="#ff3d7f" name="Платежи" />}
          <p className="mt-1 text-xs text-faint">Это обязательства — в расходы они попадут после оплаты.</p>
        </Card>
        <Card>
          <SectionTitle>Динамика погашения долга</SectionTitle>
          {!hasDebtData ? <p className="py-8 text-center text-sm text-muted">Укажите остаток долга у кредита, и здесь появится динамика.</p> : <><DebtChart data={debt} /><p className="mt-1 text-xs text-faint">Сейчас долг: {fmtMoney(totalDebt(loans))}. Прошлые значения восстановлены по оплаченным платежам (основной долг).</p></>}
        </Card>
      </div>

      <Card className="mt-5">
        <SectionTitle>Отчёт за период</SectionTitle>
        <p className="mb-4 text-sm text-muted">{fmtDate(range.from)} — {fmtDate(range.to)}. Строится из фактических записей; будущие платежи показаны отдельно и в расходы не входят.</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Общий доход" value={fmtMoney(report.income)} tone="ok" />
          <Stat label="Общие расходы" value={fmtMoney(report.expense)} />
          <Stat label="Чистый результат" value={fmtSigned(report.net)} tone={report.net >= 0 ? 'ok' : 'bad'} />
          <Stat label="Доход от смен" value={fmtMoney(report.shiftIncome)} />
          <Stat label="Другие источники" value={fmtMoney(report.otherIncome)} />
          <Stat label="Смен" value={String(report.stats.count)} />
          <Stat label="Часов" value={fmtHours(report.stats.hours)} />
          <Stat label="Средний за смену" value={fmtMoney(report.stats.avgPerShift)} />
        </div>
        {report.prev ? (
          <div className="mt-5 rounded-2xl border border-line bg-surface-2 p-4 text-sm">
            <div className="mb-2 font-semibold">К предыдущему периоду ({rangeLabel(report.prevRange)})</div>
            <div className="grid grid-cols-3 gap-3"><Delta label="Доходы" now={report.income} before={report.prev.income} good="up" /><Delta label="Расходы" now={report.expense} before={report.prev.expense} good="down" /><Delta label="Результат" now={report.net} before={report.prev.net} good="up" signed /></div>
          </div>
        ) : <p className="mt-4 text-xs text-faint">Сравнение с предыдущим периодом недоступно: за него нет данных.</p>}

        <div className="mt-5">
          <div className="mb-1 text-[13px] font-medium text-muted">Оплаченные кредитные платежи — {fmtMoney(report.paidTotal)}</div>
          {report.paid.length === 0 ? <p className="py-2 text-sm text-muted">Оплат за период нет.</p> : <div className="divide-y divide-line">{report.paid.map((p) => <Row key={p.id} onClick={() => open({ kind: 'payment', id: p.id! })} left={<Avatar color="#34d399">✓</Avatar>} title={p.loanName} sub={fmtDate(p.paidDate!)} right={fmtMoney(p.amount)} />)}</div>}
        </div>
        <div className="mt-5">
          <div className="mb-1 text-[13px] font-medium text-muted">Предстоящие платежи (не расходы) — {fmtMoney(report.upcomingTotal)}</div>
          {report.upcoming.length === 0 ? <p className="py-2 text-sm text-muted">В этом периоде предстоящих платежей нет{range.to < todayStr() ? ' — период уже в прошлом' : ''}.</p> : <div className="divide-y divide-line">{report.upcoming.map((p) => <Row key={p.id} onClick={() => open({ kind: 'payment', id: p.id! })} left={<Avatar color="#60a5fa">·</Avatar>} title={p.loanName} sub={fmtDate(p.plannedDate)} right={fmtMoney(p.amount)} />)}</div>}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="primary" icon={<FileText className="size-4" />} onClick={() => run(() => exportReportPdf(report))}>Скачать PDF</Button>
          <Button icon={<Download className="size-4" />} onClick={() => run(() => exportReportCsv(report))}>Скачать CSV</Button>
        </div>
      </Card>
    </>
  )
}

function Delta({ label, now, before, good, signed }: { label: string; now: number; before: number; good: 'up' | 'down'; signed?: boolean }) {
  const diff = Math.round((now - before) * 100) / 100
  const pct = pctChange(now, before)
  const better = diff === 0 ? null : good === 'up' ? diff > 0 : diff < 0
  return (
    <div className="min-w-0">
      <div className="truncate text-xs text-muted">{label}</div>
      <div className="mt-0.5 truncate font-semibold tabular-nums">{signed ? fmtSigned(diff) : `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${fmtMoney(Math.abs(diff))}`}</div>
      <div className={`text-xs ${better === null ? 'text-faint' : better ? 'text-ok' : 'text-bad'}`}>{pct === null ? 'нет базы для %' : `${diff >= 0 ? '+' : '−'}${fmtPercent(Math.abs(Math.round(pct)))}`}</div>
    </div>
  )
}
