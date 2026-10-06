import { Landmark, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader, Avatar, Stat } from '../components/Common'
import { PaymentsCalendar } from '../components/PaymentsCalendar'
import { ReminderList } from '../components/Reminders'
import { Button } from '../components/ui/Button'
import { Badge, Card, Progress, SectionTitle } from '../components/ui/Card'
import { Segmented } from '../components/ui/Fields'
import { Empty, Notice } from '../components/ui/Feedback'
import { LoanIcon } from '../components/ui/icons'
import { commitments, nextPaymentOf, PAYMENT_STATE_COLOR, PAYMENT_STATE_LABEL, paymentState, remainingPayments, repaidAmount, repaidPercent, reserveInfo, totalDebt } from '../lib/calc/loans'
import { computeReminders } from '../lib/notifications/reminders'
import { fmtDate, relativeDay } from '../lib/dates'
import { daysWord, fmtMoney, fmtPercent } from '../lib/money'
import { useApp } from '../store/context'
import { useUI } from '../store/ui'

type View = 'loans' | 'calendar'

export function LoansPage() {
  const { loans, payments, today } = useApp()
  const open = useUI((s) => s.open)
  const [view, setView] = useState<View>('loans')
  const [showArchive, setShowArchive] = useState(false)
  const active = loans.filter((l) => !l.archived)
  const archived = loans.filter((l) => l.archived)
  const com = useMemo(() => commitments(loans, payments, today), [loans, payments, today])
  const reminders = useMemo(() => computeReminders(loans, payments, today), [loans, payments, today])
  const debt = totalDebt(loans)

  return (
    <>
      <PageHeader title="Кредиты" sub="Займы, кредиты и рассрочки" action={<Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => open({ kind: 'loan' })}>Добавить</Button>} />
      {loans.length === 0 ? (
        <Card><Empty icon={<Landmark />} title="Кредитов пока нет" text="Добавьте кредит, заём или рассрочку — приложение само построит график платежей, напомнит о сроках и подскажет, сколько откладывать каждый день." action={<Button variant="primary" onClick={() => open({ kind: 'loan' })}>Добавить первый кредит</Button>} /></Card>
      ) : (
        <div className="space-y-5">
          <Segmented value={view} onChange={setView} options={[{ value: 'loans', label: 'Мои кредиты' }, { value: 'calendar', label: 'Календарь платежей' }]} />
          {view === 'calendar' ? <PaymentsCalendar /> : (
            <>
              {reminders.length > 0 && <ReminderList items={reminders} />}

              <Card>
                <SectionTitle>Деньги на платежи</SectionTitle>
                <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
                  <Stat label="Ближайшие 7 дней" value={fmtMoney(com.next7)} tone={com.next7 > 0 ? 'warn' : undefined} />
                  <Stat label="В этом месяце" value={fmtMoney(com.month)} />
                  <Stat label="Все предстоящие" value={fmtMoney(com.total)} />
                  <Stat label="Уже отложено" value={fmtMoney(com.reserved)} tone="ok" />
                  <Stat label="Ещё отложить (на ближайшие)" value={fmtMoney(com.shortfall)} tone={com.shortfall > 0 ? 'warn' : 'ok'} />
                  <Stat label="Остаток долга" value={fmtMoney(debt)} />
                </div>
                {com.perDay > 0 && <div className="mt-4 rounded-2xl bg-brand/10 px-4 py-3 text-sm" style={{ background: 'rgba(255,61,127,0.1)' }}>Чтобы успеть ко всем ближайшим платежам, откладывайте примерно <b className="text-brand">{fmtMoney(com.perDay)}</b> в день.</div>}
                {com.overdue > 0 && <Notice tone="bad" className="mt-3">Просроченных платежей на {fmtMoney(com.overdue)}.</Notice>}
                <p className="mt-3 text-xs text-faint">Это планирование: отложенные деньги не считаются оплаченным долгом, а будущие платежи — расходом.</p>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                {active.map((l) => {
                  const next = nextPaymentOf(l.id!, payments)
                  const st = next ? paymentState(next, today) : null
                  const pct = repaidPercent(l)
                  const left = remainingPayments(l, payments)
                  const info = reserveInfo(l, payments, today)
                  return (
                    <Card key={l.id} onClick={() => open({ kind: 'loanDetail', id: l.id! })} className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Avatar color={l.color}><LoanIcon name={l.icon} /></Avatar>
                        <div className="min-w-0 flex-1"><div className="truncate text-base font-bold">{l.name}</div>{l.bank && <div className="truncate text-xs text-muted">{l.bank}</div>}</div>
                        {st && <Badge color={PAYMENT_STATE_COLOR[st]}>{PAYMENT_STATE_LABEL[st]}</Badge>}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><div className="text-xs text-muted">Остаток долга</div><div className="mt-0.5 text-xl font-extrabold tabular-nums">{l.balance === undefined ? '—' : fmtMoney(l.balance)}</div></div>
                        <div><div className="text-xs text-muted">Следующий платёж</div><div className="mt-0.5 text-xl font-extrabold tabular-nums">{next ? fmtMoney(next.amount) : '—'}</div><div className="text-xs text-faint">{next ? `${fmtDate(next.plannedDate, 'd MMM')} · ${relativeDay(next.plannedDate, today)}` : 'график закончился'}</div></div>
                      </div>
                      {pct !== null && <div><div className="mb-1.5 flex justify-between text-xs text-muted"><span>Выплачено {fmtMoney(repaidAmount(l) ?? 0)}</span><span>{fmtPercent(Math.round(pct))}</span></div><Progress value={pct} color={l.color} /></div>}
                      <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-xs text-muted">
                        <span>{left === null ? 'Осталось платежей: неизвестно' : `Осталось платежей: ${left}`}</span>
                        {info.state === 'saving' && <span>отложить {fmtMoney(info.perDay ?? 0)}/день · {daysWord(info.daysLeft ?? 0)}</span>}
                        {info.state === 'covered' && <span className="text-ok">платёж обеспечен</span>}
                        {info.state === 'today' && <span className="text-warn">платёж сегодня</span>}
                        {info.state === 'overdue' && <span className="text-bad">просрочен</span>}
                      </div>
                      <Button size="sm" full>Подробнее</Button>
                    </Card>
                  )
                })}
              </div>

              {archived.length > 0 && (
                <div>
                  <Button size="sm" variant="ghost" onClick={() => setShowArchive(!showArchive)}>{showArchive ? 'Скрыть архив' : `Архив (${archived.length})`}</Button>
                  {showArchive && <div className="mt-2 grid gap-3 lg:grid-cols-2">{archived.map((l) => <Card key={l.id} onClick={() => open({ kind: 'loanDetail', id: l.id! })} className="flex items-center gap-3 opacity-70"><Avatar color={l.color}><LoanIcon name={l.icon} /></Avatar><span className="truncate font-medium">{l.name}</span></Card>)}</div>}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}
