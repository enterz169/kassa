import { Download, Plus, Search, Settings2, Receipt, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader, Row, Stat } from '../components/Common'
import { Donut } from '../components/charts/Charts'
import { PeriodPicker, usePeriod } from '../components/PeriodPicker'
import { TxRow } from '../components/TxRow'
import { Button } from '../components/ui/Button'
import { Card, Dot, Progress, SectionTitle } from '../components/ui/Card'
import { Input, Segmented, Select } from '../components/ui/Fields'
import { Empty, Notice } from '../components/ui/Feedback'
import { commitments, totalDebt } from '../lib/calc/loans'
import { currentBalance, expenseIn, expensesByCategory, incomeIn, shiftStats, sum } from '../lib/calc/finance'
import { exportTransactionsCsv } from '../lib/export/csv'
import { reportSave } from '../lib/export/download'
import { inRange, rangeLabel } from '../lib/dates'
import { fmtMoney, fmtSigned } from '../lib/money'
import { useApp } from '../store/context'
import { useUI, type MoneyTab } from '../store/ui'

type Sort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

export function MoneyPage() {
  const tab = useUI((s) => s.moneyTab)
  const go = useUI((s) => s.go)
  return (
    <>
      <PageHeader title="Доходы и расходы" />
      <Segmented className="mb-4" value={tab} onChange={(t: MoneyTab) => go('money', { moneyTab: t, category: null })} options={[{ value: 'income', label: 'Доходы' }, { value: 'expense', label: 'Расходы' }, { value: 'balance', label: 'Баланс' }]} />
      {tab === 'income' && <IncomeTab />}
      {tab === 'expense' && <ExpenseTab />}
      {tab === 'balance' && <BalanceTab />}
    </>
  )
}

function useFiltered(type: 'income' | 'expense') {
  const { txs, catById } = useApp()
  const preset = useUI((s) => s.moneyCategory)
  const { state, setState, range } = usePeriod('month')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>(preset ? String(preset) : 'all')
  const [sort, setSort] = useState<Sort>('date-desc')
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const out = txs.filter((t) => t.type === type && inRange(t.date, range) && (cat === 'all' || t.categoryId === Number(cat)) &&
      (!needle || [t.title, t.comment ?? '', t.note ?? '', catById.get(t.categoryId)?.name ?? ''].some((s) => s.toLowerCase().includes(needle))))
    const by = { 'date-desc': (a: typeof out[0], b: typeof out[0]) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0), 'date-asc': (a: typeof out[0], b: typeof out[0]) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0), 'amount-desc': (a: typeof out[0], b: typeof out[0]) => b.amount - a.amount, 'amount-asc': (a: typeof out[0], b: typeof out[0]) => a.amount - b.amount }
    return out.sort(by[sort])
  }, [txs, type, range, cat, q, sort, catById])
  return { state, setState, range, q, setQ, cat, setCat, sort, setSort, list }
}

function Filters({ f, type }: { f: ReturnType<typeof useFiltered>; type: 'income' | 'expense' }) {
  const { cats } = useApp()
  const options = cats.filter((c) => c.kind === type && !(type === 'income' && c.key === 'shift'))
  return (
    <div className="space-y-3">
      <PeriodPicker state={f.state} onChange={f.setState} />
      <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-faint" /><Input value={f.q} onChange={(e) => f.setQ(e.target.value)} placeholder="Поиск по названию, комментарию, категории" className="pl-11" /></div>
      <div className="grid grid-cols-2 gap-3">
        <Select value={f.cat} onChange={(e) => f.setCat(e.target.value)} aria-label="Категория"><option value="all">Все категории</option>{options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select value={f.sort} onChange={(e) => f.setSort(e.target.value as Sort)} aria-label="Сортировка"><option value="date-desc">Сначала новые</option><option value="date-asc">Сначала старые</option><option value="amount-desc">Сумма: больше</option><option value="amount-asc">Сумма: меньше</option></Select>
      </div>
    </div>
  )
}

function ExpenseTab() {
  const { cats, catById, txs } = useApp()
  const open = useUI((s) => s.open)
  const toast = useUI((s) => s.toast)
  const f = useFiltered('expense')
  const total = sum(f.list.map((t) => t.amount))
  const slices = useMemo(() => expensesByCategory(txs, cats, f.range), [txs, cats, f.range])
  const filtered = f.q.trim() !== '' || f.cat !== 'all'
  return (
    <div className="space-y-4">
      <Filters f={f} type="expense" />
      <Card>
        <div className="flex items-end justify-between gap-3">
          <div><div className="text-[13px] text-muted">Расходы · {rangeLabel(f.range)}</div><div className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums">{fmtMoney(total)}</div><div className="mt-1 text-xs text-faint">{f.list.length} записей{filtered ? ' (с учётом фильтров)' : ''}</div></div>
          <Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => open({ kind: 'tx', type: 'expense' })}>Расход</Button>
        </div>
        {!filtered && slices.length > 0 && (
          <div className="mt-5 grid items-center gap-5 border-t border-line pt-5 sm:grid-cols-[180px_1fr]">
            <Donut slices={slices} size={170} center={<><span className="text-xs text-muted">всего</span><span className="text-[15px] font-bold tabular-nums">{fmtMoney(sum(slices.map((s) => s.amount)))}</span></>} onSliceClick={(id) => f.setCat(String(id))} />
            <div className="space-y-2.5">
              {slices.slice(0, 6).map((s) => (
                <button key={s.categoryId} onClick={() => f.setCat(String(s.categoryId))} className="block w-full text-left">
                  <div className="mb-1 flex items-center justify-between gap-2 text-[13px]"><span className="flex min-w-0 items-center gap-2"><Dot color={s.color} /><span className="truncate">{s.name}</span></span><span className="shrink-0 tabular-nums text-muted">{fmtMoney(s.amount)} · {Math.round(s.share)}%</span></div>
                  <Progress value={s.share} color={s.color} height={5} />
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={<Settings2 className="size-4" />} onClick={() => open({ kind: 'categories', type: 'expense' })}>Категории</Button>
        <Button size="sm" icon={<Download className="size-4" />} disabled={!f.list.length} onClick={() => exportTransactionsCsv(f.list, cats, `rashody_${f.range.from}_${f.range.to}.csv`).then((r) => reportSave(r, toast))}>CSV</Button>
      </div>
      <Card className="p-2 sm:p-3">
        {f.list.length === 0 ? (
          <Empty icon={<Receipt />} title={filtered ? 'Ничего не найдено' : 'Расходов за период нет'} text={filtered ? 'Попробуйте изменить поиск или категорию.' : 'Запишите первый расход — статистика обновится сразу.'} action={!filtered ? <Button variant="primary" onClick={() => open({ kind: 'tx', type: 'expense' })}>Добавить расход</Button> : <Button onClick={() => { f.setQ(''); f.setCat('all') }}>Сбросить фильтры</Button>} />
        ) : <div className="divide-y divide-line">{f.list.map((t) => <TxRow key={t.id} tx={t} cat={catById.get(t.categoryId)} onClick={() => open({ kind: 'tx', type: 'expense', id: t.id })} />)}</div>}
      </Card>
    </div>
  )
}

function IncomeTab() {
  const { cats, catById, shifts, entries } = useApp()
  const open = useUI((s) => s.open)
  const go = useUI((s) => s.go)
  const toast = useUI((s) => s.toast)
  const f = useFiltered('income')
  const total = incomeIn(entries, f.range)
  const st = shiftStats(shifts, f.range)
  const bySource = useMemo(() => {
    const names: Record<string, { name: string; color: string }> = {}
    for (const c of cats.filter((x) => x.kind === 'income')) if (c.key) names[c.key] = { name: c.name, color: c.color }
    const acc = new Map<string, number>()
    for (const e of entries) if (inRange(e.date, f.range)) acc.set(e.categoryKey, (acc.get(e.categoryKey) ?? 0) + e.amount)
    return [...acc.entries()].map(([k, v]) => ({ key: k, amount: v, ...(names[k] ?? { name: catById.get(Number(k.replace('cat:', '')))?.name ?? 'Другое', color: '#9c9ca8' }) })).sort((a, b) => b.amount - a.amount)
  }, [entries, cats, f.range, catById])
  const filtered = f.q.trim() !== '' || f.cat !== 'all'
  const shiftsInPeriod = st.count

  return (
    <div className="space-y-4">
      <Filters f={f} type="income" />
      <Card>
        <div className="flex items-end justify-between gap-3">
          <div><div className="text-[13px] text-muted">Доходы · {rangeLabel(f.range)}</div><div className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums text-ok">{fmtMoney(total)}</div></div>
          <Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => open({ kind: 'tx', type: 'income' })}>Доход</Button>
        </div>
        {bySource.length > 0 && <div className="mt-5 space-y-2.5 border-t border-line pt-4">{bySource.map((s) => <div key={s.key}><div className="mb-1 flex justify-between text-[13px]"><span className="flex items-center gap-2"><Dot color={s.color} />{s.name}</span><span className="tabular-nums text-muted">{fmtMoney(s.amount)}</span></div><Progress value={total ? (s.amount / total) * 100 : 0} color={s.color} height={5} /></div>)}</div>}
      </Card>

      <Card onClick={() => go('calendar')} className="flex items-center gap-4">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-info/15 text-info"><TrendingUp className="size-5" /></span>
        <div className="min-w-0 flex-1"><div className="text-[15px] font-semibold">Заработок со смен: {fmtMoney(st.earned)}</div><div className="text-xs text-muted">{shiftsInPeriod} отработанных смен · берётся автоматически из календаря</div></div>
      </Card>

      <SectionTitle>Записи о доходах</SectionTitle>
      <Card className="p-2 sm:p-3">
        {f.list.length === 0 ? (
          <Empty icon={<TrendingUp />} title={filtered ? 'Ничего не найдено' : 'Отдельных доходов нет'} text={filtered ? 'Попробуйте изменить поиск или категорию.' : 'Смены считаются сами. Здесь — зарплата, подработка и другие поступления.'} action={<Button variant="primary" onClick={() => open({ kind: 'tx', type: 'income' })}>Добавить доход</Button>} />
        ) : <div className="divide-y divide-line">{f.list.map((t) => <TxRow key={t.id} tx={t} cat={catById.get(t.categoryId)} onClick={() => open({ kind: 'tx', type: 'income', id: t.id })} />)}</div>}
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={<Settings2 className="size-4" />} onClick={() => open({ kind: 'categories', type: 'income' })}>Источники дохода</Button>
        <Button size="sm" icon={<Download className="size-4" />} disabled={!f.list.length} onClick={() => exportTransactionsCsv(f.list, cats, `dohody_${f.range.from}_${f.range.to}.csv`).then((r) => reportSave(r, toast))}>CSV</Button>
      </div>
    </div>
  )
}

function BalanceTab() {
  const { txs, entries, shifts, settings, loans, payments, today } = useApp()
  const go = useUI((s) => s.go)
  const { state, setState, range } = usePeriod('month')
  const inc = incomeIn(entries, range)
  const exp = expenseIn(txs, range)
  const bal = currentBalance(settings?.openingBalance ?? 0, entries, txs, today)
  const com = commitments(loans, payments, today)
  const debt = totalDebt(loans)
  const st = shiftStats(shifts, range)
  return (
    <div className="space-y-4">
      <PeriodPicker state={state} onChange={setState} />
      <Card>
        <div className="text-[13px] text-muted">Результат · {rangeLabel(range)}</div>
        <div className={`mt-1 text-3xl font-extrabold tracking-tight tabular-nums ${inc - exp >= 0 ? 'text-ok' : 'text-bad'}`}>{fmtSigned(inc - exp)}</div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4"><Stat label="Доходы" value={fmtMoney(inc)} tone="ok" /><Stat label="Фактические расходы" value={fmtMoney(exp)} /><Stat label="Заработок со смен" value={fmtMoney(st.earned)} /><Stat label="Смен / часов" value={`${st.count} / ${st.hours}`} /></div>
      </Card>
      <Card>
        <div className="text-[13px] text-muted">Остаток денег на сегодня</div>
        <div className={`mt-1 text-3xl font-extrabold tabular-nums ${bal < 0 ? 'text-bad' : ''}`}>{fmtMoney(bal)}</div>
        <p className="mt-2 text-xs text-faint">Начальный остаток ({fmtMoney(settings?.openingBalance ?? 0)}) + все доходы − все фактические расходы по сегодняшний день. Начальный остаток меняется в настройках.</p>
      </Card>
      <SectionTitle>Обязательства — отдельно от фактических расходов</SectionTitle>
      <Card onClick={() => go('loans')}>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Предстоящие платежи (всего)" value={fmtMoney(com.total)} tone="warn" />
          <Stat label="В ближайшие 7 дней" value={fmtMoney(com.next7)} />
          <Stat label="Отложено на платежи" value={fmtMoney(com.reserved)} tone="ok" />
          <Stat label="Остаток долга" value={fmtMoney(debt)} />
        </div>
        {com.overdue > 0 && <Notice tone="bad" className="mt-4">Просрочено на {fmtMoney(com.overdue)}.</Notice>}
        <p className="mt-3 text-xs text-faint">Будущие платежи не уменьшают баланс и не входят в расходы, пока вы не отметите их оплаченными. Отложенные деньги — не оплаченный долг.</p>
      </Card>
      <Row title="Отчёт за период, графики и экспорт" sub="Раздел «Аналитика»" chevron onClick={() => go('analytics')} />
    </div>
  )
}
