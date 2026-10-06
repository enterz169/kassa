import { useState } from 'react'
import { markPaid, setPaymentCancelled, unmarkPaid, updatePayment } from '../../db/loans'
import { PAYMENT_METHODS } from '../../lib/constants'
import { PAYMENT_STATE_COLOR, PAYMENT_STATE_LABEL, paymentState, suggestPrincipal } from '../../lib/calc/loans'
import { daysBetween, fmtDate, todayStr } from '../../lib/dates'
import { daysWord, fmtMoney, parseMoney } from '../../lib/money'
import { useApp } from '../../store/context'
import { errText, useUI } from '../../store/ui'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Card'
import { Field, Input, MoneyInput, Segmented, Select } from '../ui/Fields'
import { Notice } from '../ui/Feedback'
import { Modal } from '../ui/Modal'
import { Stat } from '../Common'

type Mode = 'view' | 'pay' | 'edit'

export function PaymentSheet({ id }: { id: number }) {
  const { payments, loanById, today } = useApp()
  const close = useUI((s) => s.close)
  const open = useUI((s) => s.open)
  const toast = useUI((s) => s.toast)
  const ask = useUI((s) => s.ask)
  const p = payments.find((x) => x.id === id)
  const loan = p ? loanById.get(p.loanId) : undefined
  const [mode, setMode] = useState<Mode>('view')
  const [paidDate, setPaidDate] = useState(todayStr())
  const [amount, setAmount] = useState(p ? String(p.amount).replace('.', ',') : '')
  const [principal, setPrincipal] = useState('')
  const [method, setMethod] = useState(PAYMENT_METHODS[0])
  const [comment, setComment] = useState(p?.comment ?? '')
  const [newDate, setNewDate] = useState(p?.plannedDate ?? todayStr())
  const [editAmount, setEditAmount] = useState(p ? String(p.amount).replace('.', ',') : '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<Record<string, string>>({})

  if (!p || !loan) return <Modal title="Платёж" onClose={close}><p className="text-muted">Платёж не найден — возможно, он был удалён.</p></Modal>

  const state = paymentState(p, today)
  const color = PAYMENT_STATE_COLOR[state]
  const d = daysBetween(today, p.plannedDate)
  const hasBalance = loan.balance !== undefined

  const startPay = () => {
    setAmount(String(p.amount).replace('.', ','))
    setPrincipal(hasBalance ? String(suggestPrincipal(loan, p.amount)).replace('.', ',') : '')
    setMode('pay')
  }

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true)
    try { await fn(); toast(ok); setMode('view') } catch (e) { toast(errText(e), 'bad') } finally { setBusy(false) }
  }

  const confirmPay = () => {
    const e: Record<string, string> = {}
    const a = parseMoney(amount)
    const pr = principal.trim() === '' ? 0 : parseMoney(principal)
    if (a === null || a <= 0) e.amount = 'Введите сумму больше нуля'
    if (pr === null) e.principal = 'Неверная сумма'
    else if (a !== null && pr > a) e.principal = 'Не может быть больше платежа'
    else if (hasBalance && pr > loan.balance!) e.principal = 'Больше остатка долга'
    if (!paidDate) e.paidDate = 'Укажите дату'
    else if (paidDate > todayStr()) e.paidDate = 'Дата оплаты не может быть в будущем'
    setErr(e)
    if (Object.keys(e).length) return
    run(() => markPaid({ paymentId: id, paidDate, amount: a!, principal: pr ?? 0, method, comment: comment.trim() || undefined }), 'Платёж отмечен оплаченным и учтён в расходах')
  }

  const saveEdit = () => {
    const e: Record<string, string> = {}
    const a = parseMoney(editAmount)
    if (a === null || a <= 0) e.editAmount = 'Введите сумму больше нуля'
    if (!newDate) e.newDate = 'Укажите дату'
    setErr(e)
    if (Object.keys(e).length) return
    run(() => updatePayment(id, { plannedDate: newDate, amount: a!, comment: comment.trim() || undefined }), 'Платёж обновлён — новая запись не создавалась')
  }

  return (
    <Modal title={loan.name} subtitle={`Платёж за ${fmtDate(p.plannedDate, 'LLLL yyyy')}`} onClose={close}>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <Badge color={color}>{PAYMENT_STATE_LABEL[state]}{p.changed && state !== 'paid' ? ' · изменён' : ''}</Badge>
          {state !== 'paid' && state !== 'cancelled' && <span className="text-xs text-muted">{d === 0 ? 'сегодня' : d > 0 ? `через ${daysWord(d)}` : `просрочен на ${daysWord(-d)}`}</span>}
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-line bg-surface-2 p-4">
          <Stat label="Сумма" value={fmtMoney(p.amount)} />
          <Stat label="Плановая дата" value={fmtDate(p.plannedDate)} />
          {p.originalDate !== p.plannedDate && <Stat label="Исходная дата" value={fmtDate(p.originalDate)} />}
          {p.paidDate && <Stat label="Оплачен" value={fmtDate(p.paidDate)} tone="ok" />}
          {p.principalPaid !== undefined && p.status === 'paid' && hasBalance && <Stat label="В основной долг" value={fmtMoney(p.principalPaid)} />}
        </div>
        {p.comment && <p className="text-sm text-muted">{p.comment}</p>}

        {mode === 'view' && (
          <div className="space-y-3">
            {p.status === 'planned' && <>
              <Button variant="primary" full onClick={startPay}>Отметить оплаченным</Button>
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => setMode('edit')}>Перенести / изменить</Button>
                <Button onClick={() => ask({ title: 'Отменить этот платёж?', text: 'Он перестанет считаться обязательством. Позже его можно вернуть.', confirmLabel: 'Отменить платёж', onConfirm: async () => { await setPaymentCancelled(id, true); toast('Платёж отменён') } })}>Отменить платёж</Button>
              </div>
            </>}
            {p.status === 'cancelled' && <Button full onClick={() => run(() => setPaymentCancelled(id, false), 'Платёж возвращён в график')}>Вернуть платёж</Button>}
            {p.status === 'paid' && <>
              <Notice tone="good">Платёж учтён в расходах за {fmtDate(p.paidDate!)} ровно один раз.</Notice>
              {p.expenseId && <Button full onClick={() => open({ kind: 'tx', type: 'expense', id: p.expenseId })}>Открыть запись расхода</Button>}
              <Button variant="danger" full onClick={() => ask({ title: 'Отменить оплату?', text: 'Связанный расход будет удалён, остаток долга вернётся, платёж снова станет неоплаченным.', confirmLabel: 'Отменить оплату', onConfirm: async () => { await unmarkPaid(id); toast('Оплата отменена, расход удалён') } })}>Отменить оплату</Button>
            </>}
            <Button variant="ghost" full onClick={() => open({ kind: 'loanDetail', id: loan.id! })}>Открыть кредит</Button>
          </div>
        )}

        {mode === 'pay' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Дата оплаты" error={err.paidDate}><Input type="date" max={todayStr()} value={paidDate} onChange={(e) => setPaidDate(e.target.value)} invalid={!!err.paidDate} /></Field>
              <Field label="Сумма" error={err.amount}><MoneyInput value={amount} onChange={setAmount} invalid={!!err.amount} /></Field>
            </div>
            {hasBalance && <Field label="Из них в основной долг" error={err.principal} hint="Уменьшит остаток долга. Предложено ориентировочно по ставке — поправьте по данным банка."><MoneyInput value={principal} onChange={setPrincipal} invalid={!!err.principal} /></Field>}
            <Field label="Способ оплаты"><Select value={method} onChange={(e) => setMethod(e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</Select></Field>
            <Field label="Комментарий"><Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Необязательно" maxLength={160} /></Field>
            <Notice tone="info">Сумма попадёт в расходы за дату оплаты в категории «Кредиты». Отложенные деньги уменьшатся на сумму платежа.</Notice>
            <div className="flex gap-3"><Button full onClick={() => setMode('view')}>Назад</Button><Button variant="primary" full loading={busy} onClick={confirmPay}>Подтвердить</Button></div>
          </div>
        )}

        {mode === 'edit' && (
          <div className="space-y-4">
            <Segmented value="x" onChange={() => undefined} options={[{ value: 'x', label: 'Перенос и сумма этого платежа' }]} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Новая дата" error={err.newDate}><Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} invalid={!!err.newDate} /></Field>
              <Field label="Сумма" error={err.editAmount}><MoneyInput value={editAmount} onChange={setEditAmount} invalid={!!err.editAmount} /></Field>
            </div>
            <Field label="Комментарий"><Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Например, перенос по договорённости" maxLength={160} /></Field>
            <Notice tone="info">Меняется только этот платёж — второй за тот же месяц не создаётся. Остальные месяцы графика не затрагиваются.</Notice>
            <div className="flex gap-3"><Button full onClick={() => setMode('view')}>Назад</Button><Button variant="primary" full loading={busy} onClick={saveEdit}>Сохранить</Button></div>
          </div>
        )}
      </div>
    </Modal>
  )
}
