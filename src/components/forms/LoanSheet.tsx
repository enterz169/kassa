import clsx from 'clsx'
import { useState } from 'react'
import { saveLoan } from '../../db/loans'
import { DEFAULT_REMINDERS, LOAN_COLORS, LOAN_ICONS } from '../../lib/constants'
import { monthEnd, parse, todayStr } from '../../lib/dates'
import { parseMoney } from '../../lib/money'
import { useApp } from '../../store/context'
import { errText, useUI } from '../../store/ui'
import { Button } from '../ui/Button'
import { Field, Input, MoneyInput, Switch } from '../ui/Fields'
import { Notice } from '../ui/Feedback'
import { LoanIcon } from '../ui/icons'
import { Modal } from '../ui/Modal'

const s = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','))

export function LoanSheet({ id }: { id?: number }) {
  const { loans } = useApp()
  const close = useUI((x) => x.close)
  const open = useUI((x) => x.open)
  const toast = useUI((x) => x.toast)
  const ex = id ? loans.find((l) => l.id === id) : undefined

  const [name, setName] = useState(ex?.name ?? '')
  const [bank, setBank] = useState(ex?.bank ?? '')
  const [initial, setInitial] = useState(s(ex?.initialAmount))
  const [balance, setBalance] = useState(s(ex?.balance))
  const [total, setTotal] = useState(s(ex?.totalToRepay))
  const [openDate, setOpenDate] = useState(ex?.openDate ?? '')
  const [next, setNext] = useState(ex?.nextPaymentDate ?? '')
  const [payment, setPayment] = useState(s(ex?.monthlyPayment))
  const [rate, setRate] = useState(s(ex?.rate))
  const [endDate, setEndDate] = useState(ex?.endDate ?? '')
  const [day, setDay] = useState(ex ? String(ex.paymentDay) : '')
  const [dayTouched, setDayTouched] = useState(!!ex)
  const [comment, setComment] = useState(ex?.comment ?? '')
  const [color, setColor] = useState(ex?.color ?? LOAN_COLORS[0])
  const [icon, setIcon] = useState(ex?.icon ?? 'landmark')
  const [rem, setRem] = useState(ex?.reminders ?? DEFAULT_REMINDERS)
  const [customDays, setCustomDays] = useState((ex?.reminders.custom ?? []).join(', '))
  const [rebuild, setRebuild] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const scheduleChanged = !!ex && (next !== ex.nextPaymentDate || parseMoney(payment) !== ex.monthlyPayment || Number(day) !== ex.paymentDay)
  const opt = (v: string): number | null | undefined => (v.trim() === '' ? undefined : parseMoney(v))

  const submit = async () => {
    const e: Record<string, string> = {}
    const pay = parseMoney(payment)
    const ini = opt(initial); const bal = opt(balance); const tot = opt(total)
    const rt = rate.trim() === '' ? undefined : Number(rate.replace(',', '.'))
    const d = Number(day || (next ? parse(next).getDate() : 0))
    if (!name.trim()) e.name = 'Введите название'
    if (!next) e.next = 'Укажите дату ближайшего платежа'
    if (pay === null || pay <= 0) e.payment = 'Введите размер ежемесячного платежа'
    if (ini === null) e.initial = 'Неверная сумма'
    if (bal === null) e.balance = 'Неверная сумма'
    if (tot === null) e.total = 'Неверная сумма'
    if (ini && bal !== undefined && bal !== null && bal > ini) e.balance = 'Остаток не может быть больше первоначальной суммы'
    if (rt !== undefined && (!Number.isFinite(rt) || rt < 0 || rt > 1000)) e.rate = 'Ставка от 0 до 1000 %'
    if (!Number.isInteger(d) || d < 1 || d > 31) e.day = 'День месяца от 1 до 31'
    if (endDate && next && endDate < next) e.endDate = 'Дата окончания раньше ближайшего платежа'
    if (openDate && next && openDate > next) e.openDate = 'Оформление позже ближайшего платежа'
    const custom = customDays.split(/[,\s;]+/).filter(Boolean).map(Number)
    if (custom.some((n) => !Number.isInteger(n) || n < 1 || n > 90)) e.custom = 'Дни — целые числа от 1 до 90, через запятую'
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      const nid = await saveLoan({
        id: ex?.id, name: name.trim(), bank: bank.trim() || undefined,
        initialAmount: ini ?? undefined, balance: bal ?? undefined, totalToRepay: tot ?? undefined,
        openDate: openDate || undefined, nextPaymentDate: next, monthlyPayment: pay!, rate: rt,
        endDate: endDate || undefined, paymentDay: d, comment: comment.trim() || undefined, color, icon,
        reserved: ex?.reserved ?? 0, reminders: { ...rem, custom: [...new Set(custom)].sort((a, b) => b - a) }, archived: ex?.archived,
      }, { rebuildSchedule: rebuild })
      toast(ex ? 'Кредит обновлён' : 'Кредит добавлен, график платежей создан')
      open({ kind: 'loanDetail', id: nid })
    } catch (err) { toast(errText(err), 'bad') } finally { setSaving(false) }
  }

  return (
    <Modal title={ex ? 'Параметры кредита' : 'Новый кредит'} subtitle="Обязательны только название, дата и сумма платежа" onClose={close} wide
      footer={<Button variant="primary" full loading={saving} onClick={submit}>{ex ? 'Сохранить' : 'Добавить кредит'}</Button>}>
      <div className="space-y-5">
        <Field label="Название" error={errors.name}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, ипотека, кредитка, рассрочка" maxLength={60} invalid={!!errors.name} /></Field>
        <Field label="Банк или организация"><Input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Необязательно" maxLength={60} /></Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Дата ближайшего платежа" error={errors.next}>
            <Input type="date" value={next} onChange={(e) => { setNext(e.target.value); if (!dayTouched && e.target.value) setDay(String(parse(e.target.value).getDate())) }} invalid={!!errors.next} />
          </Field>
          <Field label="Ежемесячный платёж" error={errors.payment}><MoneyInput value={payment} onChange={setPayment} invalid={!!errors.payment} /></Field>
          <Field label="День платежа в месяце" error={errors.day} hint="Если в месяце меньше дней, платёж сдвинется на последний день"><Input inputMode="numeric" value={day} onChange={(e) => { setDay(e.target.value.replace(/\D/g, '').slice(0, 2)); setDayTouched(true) }} placeholder="Из даты платежа" invalid={!!errors.day} /></Field>
          <Field label="Процентная ставка, % годовых" error={errors.rate} hint="Если не знаете — оставьте пустым"><Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="Необязательно" invalid={!!errors.rate} /></Field>
          <Field label="Первоначальная сумма" error={errors.initial}><MoneyInput value={initial} onChange={setInitial} placeholder="Необязательно" invalid={!!errors.initial} /></Field>
          <Field label="Текущий остаток долга" error={errors.balance}><MoneyInput value={balance} onChange={setBalance} placeholder="Необязательно" invalid={!!errors.balance} /></Field>
          <Field label="Общая сумма к погашению" error={errors.total} hint="С процентами, если знаете"><MoneyInput value={total} onChange={setTotal} placeholder="Необязательно" invalid={!!errors.total} /></Field>
          <Field label="Дата окончания" error={errors.endDate}><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} invalid={!!errors.endDate} /></Field>
          <Field label="Дата оформления" error={errors.openDate}><Input type="date" value={openDate} max={todayStr()} onChange={(e) => setOpenDate(e.target.value)} invalid={!!errors.openDate} /></Field>
        </div>
        {endDate && <p className="-mt-2 text-xs text-faint">График закончится в {monthEnd(endDate).slice(0, 7)}.</p>}

        <Field label="Комментарий"><Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Необязательно" maxLength={200} /></Field>

        <div>
          <span className="mb-2 block text-[13px] font-medium text-muted">Цвет и значок</span>
          <div className="flex flex-wrap gap-2">{LOAN_COLORS.map((c) => <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} className="size-9 rounded-full" style={{ background: c, boxShadow: color === c ? `0 0 0 2px #111114, 0 0 0 4px ${c}` : undefined }} />)}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {LOAN_ICONS.map((ic) => (
              <button key={ic} type="button" aria-label={ic} onClick={() => setIcon(ic)} aria-pressed={icon === ic}
                className={clsx('flex size-11 items-center justify-center rounded-2xl border transition', icon === ic ? 'border-transparent' : 'border-line bg-surface-2 text-muted')}
                style={icon === ic ? { background: `${color}30`, color, boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}>
                <LoanIcon name={ic} className="size-5" />
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface-2 px-4 py-2">
          <Switch checked={rem.enabled} onChange={(v) => setRem({ ...rem, enabled: v })} label="Напоминания о платежах" hint="Для этого кредита" />
          {rem.enabled && (
            <div className="border-t border-line pt-1">
              <Switch checked={rem.d7} onChange={(v) => setRem({ ...rem, d7: v })} label="За 7 дней" />
              <Switch checked={rem.d3} onChange={(v) => setRem({ ...rem, d3: v })} label="За 3 дня" />
              <Switch checked={rem.d1} onChange={(v) => setRem({ ...rem, d1: v })} label="За 1 день" />
              <Switch checked={rem.d0} onChange={(v) => setRem({ ...rem, d0: v })} label="В день платежа" />
              <div className="pb-2 pt-1"><Field label="Свои интервалы (за сколько дней)" error={errors.custom}><Input value={customDays} onChange={(e) => setCustomDays(e.target.value)} placeholder="Например: 14, 5" invalid={!!errors.custom} /></Field></div>
            </div>
          )}
        </div>

        {scheduleChanged && (
          <Notice tone="warn">
            Вы изменили дату, день или сумму платежа. <Switch checked={rebuild} onChange={setRebuild} label="Пересоздать будущие неоплаченные платежи" hint="Оплаченные платежи и история сохранятся. Без этого изменятся только параметры кредита." />
          </Notice>
        )}
      </div>
    </Modal>
  )
}
