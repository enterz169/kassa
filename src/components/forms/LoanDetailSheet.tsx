import { Archive, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { deleteLoan, saveLoan, setReserved } from '../../db/loans'
import { estimatePayoff, PAYMENT_STATE_COLOR, PAYMENT_STATE_LABEL, paymentState, remainingPayments, repaidAmount, repaidPercent, reserveInfo } from '../../lib/calc/loans'
import { daysWord, fmtMoney, fmtPercent, parseMoney } from '../../lib/money'
import { fmtDate, fmtShort } from '../../lib/dates'
import { useApp } from '../../store/context'
import { errText, useUI } from '../../store/ui'
import { Avatar, Row, Stat } from '../Common'
import { Button } from '../ui/Button'
import { Badge, Progress } from '../ui/Card'
import { Field, MoneyInput, Segmented } from '../ui/Fields'
import { Notice } from '../ui/Feedback'
import { LoanIcon } from '../ui/icons'
import { Modal } from '../ui/Modal'

type Tab = 'payments' | 'params' | 'calc'

export function LoanDetailSheet({ id }: { id: number }) {
  const { loanById, payments, today } = useApp()
  const close = useUI((s) => s.close)
  const open = useUI((s) => s.open)
  const toast = useUI((s) => s.toast)
  const ask = useUI((s) => s.ask)
  const loan = loanById.get(id)
  const [tab, setTab] = useState<Tab>('payments')
  const [reserve, setReserve] = useState(loan ? String(loan.reserved).replace('.', ',') : '')

  const mine = useMemo(() => payments.filter((p) => p.loanId === id).sort((a, b) => a.plannedDate.localeCompare(b.plannedDate)), [payments, id])
  if (!loan) return <Modal title="Кредит" onClose={close}><p className="text-muted">Кредит не найден.</p></Modal>

  const left = remainingPayments(loan, payments)
  const pct = repaidPercent(loan)
  const repaid = repaidAmount(loan)
  const info = reserveInfo(loan, payments, today)
  const estimate = estimatePayoff(loan)
  const history = [...mine].filter((p) => p.status === 'paid').reverse()
  const upcoming = mine.filter((p) => p.status !== 'paid')

  const saveReserve = async () => {
    const v = reserve.trim() === '' ? 0 : parseMoney(reserve)
    if (v === null) { toast('Неверная сумма резерва', 'bad'); return }
    await setReserved(id, v)
    toast('Отложенная сумма сохранена')
  }

  const archive = async () => {
    try { await saveLoan({ ...loan, archived: !loan.archived }); toast(loan.archived ? 'Кредит возвращён' : 'Кредит в архиве'); close() } catch (e) { toast(errText(e), 'bad') }
  }
  const remove = () => ask({
    title: `Удалить «${loan.name}»?`, text: 'График и история платежей будут удалены. Уже совершённые расходы останутся в разделе «Расходы».',
    onConfirm: async () => { await deleteLoan(id); toast('Кредит удалён'); close() },
  })

  const row = (p: (typeof mine)[number]) => {
    const st = paymentState(p, today)
    return (
      <Row key={p.id} onClick={() => open({ kind: 'payment', id: p.id! })} chevron
        title={fmtDate(p.status === 'paid' ? p.paidDate ?? p.plannedDate : p.plannedDate)}
        sub={<span style={{ color: PAYMENT_STATE_COLOR[st] }}>{PAYMENT_STATE_LABEL[st]}{p.changed && st !== 'paid' ? ' · изменён' : ''}</span>}
        right={fmtMoney(p.amount)} />
    )
  }

  return (
    <Modal title={loan.name} subtitle={loan.bank} onClose={close} wide>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Avatar color={loan.color}><LoanIcon name={loan.icon} /></Avatar>
          <div className="min-w-0 flex-1">
            {loan.balance !== undefined ? <><div className="text-xs text-muted">Остаток долга</div><div className="text-2xl font-extrabold tabular-nums">{fmtMoney(loan.balance)}</div></> : <div className="text-sm text-muted">Остаток долга не указан</div>}
          </div>
          <Button size="sm" icon={<Pencil className="size-4" />} onClick={() => open({ kind: 'loan', id })}>Изменить</Button>
        </div>

        {pct !== null && <div><div className="mb-1.5 flex justify-between text-xs text-muted"><span>Выплачено {fmtMoney(repaid ?? 0)}</span><span>{fmtPercent(Math.round(pct))}</span></div><Progress value={pct} color={loan.color} /></div>}

        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-line bg-surface-2 p-4 sm:grid-cols-4">
          <Stat label="Платёж" value={fmtMoney(loan.monthlyPayment)} />
          <Stat label="Следующий" value={info.payment ? fmtShort(info.payment.plannedDate) : '—'} />
          <Stat label="Осталось платежей" value={left === null ? 'неизвестно' : String(left)} />
          <Stat label="Ставка" value={loan.rate === undefined ? '—' : `${loan.rate}%`} />
        </div>
        {left === null && <p className="-mt-2 text-xs text-faint">Количество оставшихся платежей не показываем: чтобы его рассчитать, нужна дата окончания, общая сумма к погашению или нулевая ставка.</p>}

        <div className="rounded-2xl border border-line bg-surface-2 p-4">
          <div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold">Деньги на ближайший платёж</span>{info.payment && <Badge color={PAYMENT_STATE_COLOR[paymentState(info.payment, today)]}>{info.daysLeft === 0 ? 'сегодня' : (info.daysLeft ?? 0) < 0 ? 'просрочен' : `${daysWord(info.daysLeft ?? 0)}`}</Badge>}</div>
          {info.state === 'none' ? <p className="text-sm text-muted">Нет предстоящих платежей.</p> : (
            <>
              <div className="grid grid-cols-3 gap-3"><Stat label="Платёж" value={fmtMoney(info.amount)} /><Stat label="Отложено" value={fmtMoney(info.saved)} tone="ok" /><Stat label="Осталось" value={fmtMoney(info.left)} tone={info.left > 0 ? 'warn' : 'ok'} /></div>
              <div className="mt-3"><Progress value={info.amount > 0 ? (info.saved / info.amount) * 100 : 0} color="#34d399" /></div>
              <div className="mt-3 text-sm">
                {info.state === 'covered' && <span className="text-ok">Платёж полностью обеспечен.</span>}
                {info.state === 'saving' && <span>Откладывайте примерно <b className="text-brand">{fmtMoney(info.perDay ?? 0)}</b> в день до платежа.</span>}
                {info.state === 'today' && <span className="text-warn">Платёж сегодня — на дневной резерв времени нет. Не хватает {fmtMoney(info.left)}.</span>}
                {info.state === 'overdue' && <span className="text-bad">Дата платежа прошла. Оплатите и отметьте платёж — или перенесите дату.</span>}
              </div>
            </>
          )}
          <div className="mt-4 flex items-end gap-2">
            <Field label="Сколько уже отложено" className="flex-1"><MoneyInput value={reserve} onChange={setReserve} /></Field>
            <Button onClick={saveReserve}>Сохранить</Button>
          </div>
          <p className="mt-2 text-xs text-faint">Отложенные деньги — не оплаченный долг: остаток долга они не уменьшают, пока платёж не отмечен оплаченным.</p>
        </div>

        <Segmented value={tab} onChange={setTab} options={[{ value: 'payments', label: 'Платежи' }, { value: 'params', label: 'Параметры' }, { value: 'calc', label: 'Расчёт' }]} />

        {tab === 'payments' && (
          <div className="space-y-4">
            <div><div className="mb-1 text-[13px] font-medium text-muted">График</div>{upcoming.length ? <div className="divide-y divide-line">{upcoming.map(row)}</div> : <p className="py-2 text-sm text-muted">Предстоящих платежей нет.</p>}</div>
            <div><div className="mb-1 text-[13px] font-medium text-muted">История оплат</div>{history.length ? <div className="divide-y divide-line">{history.map(row)}</div> : <p className="py-2 text-sm text-muted">Оплаченных платежей пока нет.</p>}</div>
          </div>
        )}

        {tab === 'params' && (
          <div className="grid grid-cols-2 gap-4 rounded-2xl border border-line bg-surface-2 p-4">
            <Stat label="Первоначальная сумма" value={loan.initialAmount === undefined ? '—' : fmtMoney(loan.initialAmount)} />
            <Stat label="К погашению всего" value={loan.totalToRepay === undefined ? '—' : fmtMoney(loan.totalToRepay)} />
            <Stat label="Оформлен" value={loan.openDate ? fmtDate(loan.openDate) : '—'} />
            <Stat label="Окончание" value={loan.endDate ? fmtDate(loan.endDate) : '—'} />
            <Stat label="День платежа" value={String(loan.paymentDay)} />
            <Stat label="Напоминания" value={loan.reminders.enabled ? [loan.reminders.d7 && '7', loan.reminders.d3 && '3', loan.reminders.d1 && '1', loan.reminders.d0 && '0', ...loan.reminders.custom].filter(Boolean).join(', ') + ' дн.' : 'выключены'} />
            {loan.comment && <div className="col-span-2 text-sm text-muted">{loan.comment}</div>}
          </div>
        )}

        {tab === 'calc' && (
          'error' in estimate ? <Notice tone="info">Точный расчёт срока и переплаты недоступен. {estimate.error} Мы не подставляем «примерные» числа без нужных данных.</Notice> : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4 rounded-2xl border border-line bg-surface-2 p-4"><Stat label="Платежей до конца" value={String(estimate.months)} /><Stat label="Переплата" value={fmtMoney(estimate.totalInterest)} tone="warn" /><Stat label="Последний платёж" value={fmtDate(estimate.finalDate, 'LLL yyyy')} /></div>
              <Notice tone="warn"><b>Ориентировочный расчёт. Допущения:</b><ul className="mt-1.5 list-disc space-y-1 pl-5">{estimate.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></Notice>
            </div>
          )
        )}

        <div className="flex gap-3 pt-1">
          <Button full icon={<Archive className="size-4" />} onClick={archive}>{loan.archived ? 'Вернуть из архива' : 'В архив'}</Button>
          <Button variant="danger" full icon={<Trash2 className="size-4" />} onClick={remove}>Удалить</Button>
        </div>
      </div>
    </Modal>
  )
}
