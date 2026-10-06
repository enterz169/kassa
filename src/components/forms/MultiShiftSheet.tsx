import { useState } from 'react'
import { savePreset } from '../../db/presets'
import { createShiftsBulk, type ShiftInput } from '../../db/shifts'
import { calcHours } from '../../lib/calc/shifts'
import { PAY_MODES, SHIFT_STATUS } from '../../lib/constants'
import { fmtDate } from '../../lib/dates'
import { parseMoney, plural } from '../../lib/money'
import { useApp } from '../../store/context'
import { errText, useUI } from '../../store/ui'
import type { PayMode, ShiftStatus } from '../../types'
import { Button } from '../ui/Button'
import { Field, Input, MoneyInput, Segmented, Switch } from '../ui/Fields'
import { Notice } from '../ui/Feedback'
import { Modal } from '../ui/Modal'

const KINDS: { value: ShiftStatus; label: string }[] = [
  { value: 'work', label: 'Смена' },
  { value: 'dayoff', label: 'Выходной' },
  { value: 'vacation', label: 'Отпуск' },
  { value: 'sick', label: 'Больничный' },
]

/** Одна и та же запись сразу для нескольких выбранных дней календаря. */
export function MultiShiftSheet({ dates }: { dates: string[] }) {
  const { settings, shifts, today } = useApp()
  const close = useUI((s) => s.close)
  const toast = useUI((s) => s.toast)
  const st = settings!
  const sorted = [...dates].sort()
  const taken = new Set(shifts.map((s) => s.date))
  const free = sorted.filter((d) => !taken.has(d))

  const [kind, setKind] = useState<ShiftStatus>('work')
  const [start, setStart] = useState(st.defaultStart)
  const [end, setEnd] = useState(st.defaultEnd)
  const [breakMin, setBreakMin] = useState(String(st.defaultBreak))
  const [payMode, setPayMode] = useState<PayMode>(st.defaultPayMode === 'manual' ? 'hourly' : st.defaultPayMode)
  const [rate, setRate] = useState(st.defaultRate ? String(st.defaultRate) : '')
  const [fixed, setFixed] = useState('')
  const [asWorked, setAsWorked] = useState(false)
  const [saving, setSaving] = useState(false)

  const brk = Number.parseInt(breakMin || '0', 10) || 0
  const hours = calcHours(start || undefined, end || undefined, brk) ?? 0
  const hasPast = free.some((d) => d <= today)

  const submit = async () => {
    const r = rate.trim() === '' ? 0 : parseMoney(rate)
    const f = fixed.trim() === '' ? 0 : parseMoney(fixed)
    if (kind === 'work' && (r === null || f === null)) { toast('Проверьте ставку и сумму', 'bad'); return }
    const items: ShiftInput[] = free.map((date) => kind === 'work'
      ? { date, status: asWorked ? 'work' : 'planned', start: start || undefined, end: end || undefined, breakMin: brk, hours, payMode, rate: r ?? 0, fixedPay: f ?? 0, manualTotal: 0, tips: 0, bonus: 0, extra: 0 }
      : { date, status: kind, breakMin: 0, hours: 0, payMode, rate: 0, fixedPay: 0, manualTotal: 0, tips: 0, bonus: 0, extra: 0 })
    setSaving(true)
    try {
      const res = await createShiftsBulk(items)
      if (kind === 'work') await savePreset({ status: 'work', color: SHIFT_STATUS.work.color, start: start || undefined, end: end || undefined, breakMin: brk, payMode, rate: r ?? 0, fixedPay: f ?? 0, manualTotal: 0, tips: 0, bonus: 0, extra: 0 })
      toast(`Добавлено дней: ${res.created}`)
      close()
    } catch (e) { toast(errText(e), 'bad') } finally { setSaving(false) }
  }

  return (
    <Modal title="Несколько дней сразу" subtitle={`Выбрано: ${sorted.length} ${plural(sorted.length, ['день', 'дня', 'дней'])}`} onClose={close}
      footer={<Button variant="primary" full loading={saving} disabled={free.length === 0} onClick={submit}>{free.length ? `Добавить на ${free.length} ${plural(free.length, ['день', 'дня', 'дней'])}` : 'Все выбранные дни заняты'}</Button>}>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-1.5 text-xs text-muted">{sorted.map((d) => <span key={d} className={`rounded-full border px-2.5 py-1 ${taken.has(d) ? 'border-warn/40 text-warn' : 'border-line'}`}>{fmtDate(d, 'd MMM')}</span>)}</div>
        {free.length < sorted.length && <Notice tone="warn">В дни с записью ({sorted.length - free.length}) ничего не изменится — откройте такой день и поправьте его отдельно.</Notice>}

        <Segmented value={kind} onChange={setKind} options={KINDS} />

        {kind === 'work' ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Начало"><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
              <Field label="Конец"><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
              <Field label="Перерыв, мин"><Input inputMode="numeric" value={breakMin} onChange={(e) => setBreakMin(e.target.value.replace(/\D/g, ''))} /></Field>
            </div>
            <p className="-mt-3 text-xs text-faint">Часов в смене: {hours}</p>
            <Segmented value={payMode === 'manual' ? 'hourly' : payMode} onChange={setPayMode} options={(['hourly', 'fixed'] as PayMode[]).map((k) => ({ value: k, label: PAY_MODES[k].label }))} />
            {payMode === 'fixed' ? <Field label="Оплата за смену"><MoneyInput value={fixed} onChange={setFixed} /></Field> : <Field label="Ставка в час"><MoneyInput value={rate} onChange={setRate} /></Field>}
            {hasPast && <Switch checked={asWorked} onChange={setAsWorked} label="Уже отработаны" hint="Включите, если дни в прошлом — деньги сразу попадут в доход. Иначе смены будут запланированными." />}
            <p className="text-xs text-faint">Данные запомнятся в статусе «Смена» — в следующий раз достаточно выбрать дни и нажать «Смена».</p>
          </>
        ) : <Notice tone="info">Дни получат статус «{SHIFT_STATUS[kind].label}».</Notice>}
      </div>
    </Modal>
  )
}
