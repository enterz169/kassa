import { Banknote, CalendarCheck, Clock3, Hourglass, Lightbulb, PiggyBank, Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Fragment, useMemo } from 'react'
import { StatCard, Row, Avatar, PageHeader } from '../components/Common'
import { FlowChart } from '../components/charts/Charts'
import { ReminderList } from '../components/Reminders'
import { TxRow } from '../components/TxRow'
import { Button } from '../components/ui/Button'
import { Badge, Card, SectionTitle } from '../components/ui/Card'
import { Notice } from '../components/ui/Feedback'
import { loadDemoData } from '../db/demo'
import { buildInsights } from '../lib/calc/insights'
import { commitments, openPayments, paymentState, PAYMENT_STATE_COLOR, PAYMENT_STATE_LABEL, totalDebt } from '../lib/calc/loans'
import { calcShiftPay } from '../lib/calc/shifts'
import { currentBalance, dailySeries, expenseIn, incomeIn, shiftStats } from '../lib/calc/finance'
import { computeReminders } from '../lib/notifications/reminders'
import { fmtDate, fmtFullToday, fmtShort, greeting, monthEnd, monthStart, relativeDay, parse } from '../lib/dates'
import { SHIFT_STATUS } from '../lib/constants'
import { fmtHours, fmtMoney, fmtSigned } from '../lib/money'
import { useApp } from '../store/context'
import { normalizeTheme } from '../lib/theme'
import { errText, useUI } from '../store/ui'

export function HomePage() {
  const d = useApp()
  const { today, shifts, txs, cats, loans, payments, entries, settings, catById, loanById } = d
  const go = useUI((s) => s.go)
  const open = useUI((s) => s.open)
  const toast = useUI((s) => s.toast)

  const m = useMemo(() => ({ from: monthStart(today), to: monthEnd(today) }), [today])
  const incToday = incomeIn(entries, { from: today, to: today })
  const incMonth = incomeIn(entries, { from: m.from, to: today })
  const expMonth = expenseIn(txs, { from: m.from, to: today })
  const net = incMonth - expMonth
  const st = shiftStats(shifts, { from: m.from, to: today })
  const balance = currentBalance(settings?.openingBalance ?? 0, entries, txs, today)
  const com = commitments(loans, payments, today)
  const debt = totalDebt(loans)
  const series = useMemo(() => dailySeries(entries, txs, m).map((p) => ({ label: String(parse(p.date).getDate()), income: p.income, expense: p.expense, key: p.date })), [entries, txs, m])
  const insights = useMemo(() => buildInsights({ today, shifts, entries, txs, cats, loans, payments }), [today, shifts, entries, txs, cats, loans, payments])
  const reminders = useMemo(() => computeReminders(loans, payments, today), [loans, payments, today])

  const nextShifts = useMemo(() => shifts.filter((s) => s.date >= today && (s.status === 'work' || s.status === 'planned')).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4), [shifts, today])
  const lastExp = useMemo(() => txs.filter((t) => t.type === 'expense').sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0)).slice(0, 5), [txs])
  const nextPays = useMemo(() => openPayments(payments).filter((p) => loanById.get(p.loanId) && !loanById.get(p.loanId)!.archived).slice(0, 4), [payments, loanById])
  const nearest = nextPays[0]
  const nearestLoan = nearest ? loanById.get(nearest.loanId) : undefined
  const theme = normalizeTheme(settings?.theme)
  const { order, hidden } = theme
  const empty = shifts.length === 0 && txs.length === 0 && loans.length === 0

  const demo = async () => { try { await loadDemoData(); toast('Демо-данные загружены') } catch (e) { toast(errText(e), 'bad') } }

  return (
    <>
      <PageHeader title={`${greeting()}${settings?.userName ? `, ${settings.userName}` : ''}`} sub={fmtFullToday().replace(/^./, (c) => c.toUpperCase())} />

      {empty && (
        <Card className="mb-5 overflow-hidden border-pink/30 bg-gradient-to-br from-orange/10 via-pink/10 to-purple/10 text-center">
          <div className="mx-auto max-w-md py-4">
            <h2 className="text-xl font-extrabold tracking-tight">Добро пожаловать в «Кассу»</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">Отмечайте смены, записывайте расходы и кредиты — здесь сразу будет видно, сколько вы заработали, куда уходят деньги и сколько нужно отложить на платежи.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button variant="primary" onClick={() => open({ kind: 'shift', date: today })}>Добавить первую смену</Button>
              <Button onClick={() => open({ kind: 'tx', type: 'expense' })}>Записать расход</Button>
              <Button onClick={demo}>Загрузить демо-данные</Button>
            </div>
          </div>
        </Card>
      )}

      {order.filter((b) => !hidden.includes(b)).map((b) => (
        <Fragment key={b}>
          {b === 'hero' && (
<>
      <Card className="relative mb-4 overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-brand opacity-20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] text-muted">Остаток денег</div>
            <div className={`mt-1 truncate text-[34px] font-extrabold leading-none tracking-tight tabular-nums ${balance < 0 ? 'text-bad' : ''}`}>{fmtMoney(balance)}</div>
            <div className="mt-2 text-xs text-faint">Доходы минус фактические расходы{settings?.openingBalance ? ' + начальный остаток' : ''}. Будущие платежи не вычитаются.</div>
          </div>
          <Button size="sm" onClick={() => go('money', { moneyTab: 'balance' })}>Баланс</Button>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <Mini icon={TrendingDown} label="Расходы за месяц" value={fmtMoney(expMonth)} hint="фактические" onClick={() => go('money', { moneyTab: 'expense' })} />
          <Mini icon={Clock3} label="Платежи в этом месяце" value={fmtMoney(com.month)} hint="предстоящие" tone="warn" onClick={() => go('loans')} />
          <Mini icon={PiggyBank} label="Отложено на платежи" value={fmtMoney(com.reserved)} hint={com.shortfall > 0 ? `ещё ${fmtMoney(com.shortfall)}` : 'хватает'} tone="ok" onClick={() => go('loans')} />
          <Mini icon={Scale} label="Остаток долга" value={fmtMoney(debt)} hint="по кредитам" onClick={() => go('loans')} />
        </div>
      </Card>

</>
          )}
          {b === 'reminders' && (
<>
      {reminders.length > 0 && <div className="mb-4"><ReminderList items={reminders} /></div>}

</>
          )}
          {b === 'stats' && (
<>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Доход сегодня" value={fmtMoney(incToday)} icon={Banknote} tone={incToday > 0 ? 'ok' : undefined} onClick={() => go('money', { moneyTab: 'income' })} />
        <StatCard label="Доход за месяц" value={fmtMoney(incMonth)} icon={TrendingUp} tone="ok" onClick={() => go('money', { moneyTab: 'income' })} />
        <StatCard label="Расходы за месяц" value={fmtMoney(expMonth)} icon={TrendingDown} onClick={() => go('money', { moneyTab: 'expense' })} />
        <StatCard label="Чистый результат" value={fmtSigned(net)} icon={Wallet} tone={net >= 0 ? 'ok' : 'bad'} sub="за месяц" onClick={() => go('analytics')} />
        <StatCard label="Смен за месяц" value={String(st.count)} icon={CalendarCheck} onClick={() => go('calendar')} />
        <StatCard label="Отработано часов" value={fmtHours(st.hours)} icon={Hourglass} onClick={() => go('calendar')} />
        <StatCard label="Средний за смену" value={st.count ? fmtMoney(st.avgPerShift) : '—'} icon={Banknote} sub={st.avgRate > 0 ? `≈ ${fmtMoney(st.avgRate)}/ч` : undefined} onClick={() => go('analytics')} />
        <StatCard label="Ближайший платёж" value={nearest ? fmtMoney(nearest.amount) : '—'} icon={Clock3} tone={nearest && paymentState(nearest, today) !== 'upcoming' ? (paymentState(nearest, today) === 'overdue' ? 'bad' : 'warn') : undefined} sub={nearest ? `${nearestLoan?.name} · ${relativeDay(nearest.plannedDate, today)}` : 'нет платежей'} onClick={() => go('loans')} />
      </div>

</>
          )}
          {b === 'insights' && (
<>
      {insights.length > 0 && (
        <div className="mb-5">
          <SectionTitle><span className="inline-flex items-center gap-2"><Lightbulb className="size-4 text-warn" />Выводы</span></SectionTitle>
          <div className="grid gap-2 lg:grid-cols-2">
            {insights.slice(0, 6).map((i) => <Notice key={i.id} tone={i.tone === 'good' ? 'good' : i.tone === 'bad' ? 'bad' : i.tone === 'warn' ? 'warn' : 'info'}>{i.text}</Notice>)}
          </div>
        </div>
      )}

</>
          )}
          {b === 'chart' && (
<>
      <Card className="mb-5">
        <SectionTitle action={<Button size="sm" variant="ghost" onClick={() => go('analytics')}>Аналитика</Button>}>Доходы и расходы по дням</SectionTitle>
        {incMonth === 0 && expMonth === 0 ? <p className="py-10 text-center text-sm text-muted">В этом месяце пока нет данных для графика.</p> : <FlowChart data={series} tickEvery={3} labelFormatter={(l) => `${l} число`} />}
        <div className="mt-2 flex justify-center gap-5 text-xs text-muted"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-ok" />Доходы</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full" style={{ background: '#ff5a7a' }} />Расходы</span></div>
      </Card>

</>
          )}
          {b === 'lists' && (
<>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <SectionTitle action={<Button size="sm" variant="ghost" onClick={() => go('calendar')}>Все</Button>}>Ближайшие смены</SectionTitle>
          {nextShifts.length === 0 ? <Empty text="Смен не запланировано" action={<Button size="sm" onClick={() => open({ kind: 'recurring' })}>Запланировать</Button>} /> : (
            <div className="divide-y divide-line">
              {nextShifts.map((s) => (
                <Row key={s.id} onClick={() => open({ kind: 'shift', date: s.date })}
                  left={<Avatar color={SHIFT_STATUS[s.status].color}><CalendarCheck /></Avatar>}
                  title={`${relativeDay(s.date, today) === fmtShort(s.date) ? fmtDate(s.date, 'EEE, d MMM') : relativeDay(s.date, today)}`}
                  sub={s.start && s.end ? `${s.start}–${s.end} · ${fmtHours(s.hours)}` : fmtHours(s.hours)}
                  right={fmtMoney(calcShiftPay(s).total)} rightSub={SHIFT_STATUS[s.status].short} />
              ))}
            </div>
          )}
        </Card>
        <Card>
          <SectionTitle action={<Button size="sm" variant="ghost" onClick={() => go('money', { moneyTab: 'expense' })}>Все</Button>}>Последние расходы</SectionTitle>
          {lastExp.length === 0 ? <Empty text="Расходов пока нет" action={<Button size="sm" onClick={() => open({ kind: 'tx', type: 'expense' })}>Добавить расход</Button>} /> : (
            <div className="divide-y divide-line">{lastExp.map((t) => <TxRow key={t.id} tx={t} cat={catById.get(t.categoryId)} onClick={() => open({ kind: 'tx', type: 'expense', id: t.id })} />)}</div>
          )}
        </Card>
        <Card>
          <SectionTitle action={<Button size="sm" variant="ghost" onClick={() => go('loans')}>Все</Button>}>Платежи по кредитам</SectionTitle>
          {nextPays.length === 0 ? <Empty text="Кредитов пока нет" action={<Button size="sm" onClick={() => open({ kind: 'loan' })}>Добавить кредит</Button>} /> : (
            <div className="divide-y divide-line">
              {nextPays.map((p) => {
                const l = loanById.get(p.loanId)!
                const s = paymentState(p, today)
                return <Row key={p.id} onClick={() => open({ kind: 'payment', id: p.id! })} title={l.name} sub={<span style={{ color: PAYMENT_STATE_COLOR[s] }}>{relativeDay(p.plannedDate, today)} · {PAYMENT_STATE_LABEL[s]}</span>} right={fmtMoney(p.amount)} />
              })}
            </div>
          )}
          {nextPays.length > 0 && <div className="mt-3 flex flex-wrap gap-2"><Badge color="#fbbf24">7 дней: {fmtMoney(com.next7)}</Badge>{com.overdue > 0 && <Badge color="#fb5a6b">просрочено: {fmtMoney(com.overdue)}</Badge>}</div>}
        </Card>
      </div>
</>
          )}
        </Fragment>
      ))}
    </>
  )
}

function Mini({ icon: Icon, label, value, hint, tone, onClick }: { icon: typeof Wallet; label: string; value: string; hint?: string; tone?: 'ok' | 'warn'; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="min-w-0 rounded-xl p-1 text-left transition hover:bg-white/4">
      <div className="flex items-center gap-1.5 text-xs text-muted"><Icon className="size-3.5 shrink-0" /><span className="truncate">{label}</span></div>
      <div className={`mt-1 truncate text-[17px] font-bold tabular-nums ${tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : ''}`}>{value}</div>
      {hint && <div className="truncate text-[11px] text-faint">{hint}</div>}
    </button>
  )
}

function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-3 py-6 text-center"><p className="text-sm text-muted">{text}</p>{action}</div>
}
