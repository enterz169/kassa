import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { createShiftsBulk, type ShiftInput } from '../../db/shifts'
import { calcHours } from '../../lib/calc/shifts'
import { WEEKDAYS } from '../../lib/calendar/grid'
import { expandPattern, MAX_SPAN_DAYS, PRESETS, type Pattern } from '../../lib/calendar/recurrence'
import { addMonthsStr, daysBetween, monthEnd, todayStr } from '../../lib/dates'
import { parseMoney, plural } from '../../lib/money'
import { PAY_MODES } from '../../lib/constants'
import { useApp } from '../../store/context'
import { errText, useUI } from '../../store/ui'
import type { PayMode } from '../../types'
import { Button } from '../ui/Button'
import { Field, Input, MoneyInput, Segmented, Switch } from '../ui/Fields'
import { Notice } from '../ui/Feedback'
import { Modal } from '../ui/Modal'

export function RecurringSheet({ date }: { date?: string }) {
  const { shifts, settings } = useApp()
  const close = useUI((s) => s.close)
  const toast = useUI((s) => s.toast)
  const st = settings!
  const from0 = date ?? todayStr()

  const [presetId, setPresetId] = useState('2/2')
  const [work, setWork] = useState('2')
  const [off, setOff] = useState('2')
  const [days, setDays] = useState<number[]>([1, 3, 5])
  const [from, setFrom] = useState(from0)
  const [to, setTo] = useState(monthEnd(addMonthsStr(from0, 0)))
  const [start, setStart] = useState(st.defaultStart)
  const [end, setEnd] = useState(st.defaultEnd)
  const [breakMin, setBreakMin] = useState(String(st.defaultBreak))
  const [payMode, setPayMode] = useState<PayMode>(st.defaultPayMode)
  const [rate, setRate] = useState(st.defaultRate ? String(st.defaultRate) : '')
  const [fixed, setFixed] = useState('')
  const [markOff, setMarkOff] = useState(false)
  const [saving, setSaving] = useState(false)

  const preset = PRESETS.find((p) => p.id === presetId)!
  const pattern: Pattern = useMemo(() => {
    if (presetId === 'days') return { kind: 'weekdays', days }
    if (presetId === 'cycle') return { kind: 'cycle', work: Number(work) || 1, off: Number(off) || 0 }
    return preset.pattern
  }, [presetId, days, work, off, preset])

  const span = from && to ? daysBetween(from, to) + 1 : 0
  const rangeError = !from || !to ? 'Укажите период' : to < from ? 'Конец раньше начала' : span > MAX_SPAN_DAYS ? `Период не длиннее ${MAX_SPAN_DAYS} дней` : undefined
  const planned = useMemo(() => (rangeError ? [] : expandPattern(pattern, { from, to })), [pattern, from, to, rangeError])
  const taken = useMemo(() => new Set(shifts.map((s) => s.date)), [shifts])
  const workDays = planned.filter((p) => p.work)
  const offDays = planned.filter((p) => !p.work)
  const workFree = workDays.filter((p) => !taken.has(p.date)).length
  const offFree = markOff ? offDays.filter((p) => !taken.has(p.date)).length : 0
  const skipped = planned.filter((p) => taken.has(p.date) && (p.work || markOff)).length
  const dayErr = presetId === 'days' && days.length === 0 ? 'Выберите хотя бы один день недели' : undefined

  const submit = async () => {
    if (rangeError || dayErr) return
    const brk = Number.parseInt(breakMin || '0', 10) || 0
    const hours = calcHours(start || undefined, end || undefined, brk) ?? 0
    const r = parseMoney(rate || '0'); const f = parseMoney(fixed || '0')
    if (r === null || f === null) { toast('Проверьте ставку и сумму', 'bad'); return }
    const seriesId = `s-${Date.now()}`
    const base = { breakMin: brk, hours, payMode, rate: r, fixedPay: f, manualTotal: 0, tips: 0, bonus: 0, extra: 0, seriesId }
    const items: ShiftInput[] = planned
      .filter((p) => p.work || markOff)
      .map((p) => (p.work
        ? { ...base, date: p.date, status: 'planned' as const, start: start || undefined, end: end || undefined }
        : { date: p.date, status: 'dayoff' as const, breakMin: 0, hours: 0, payMode, rate: 0, fixedPay: 0, manualTotal: 0, tips: 0, bonus: 0, extra: 0, seriesId }))
    setSaving(true)
    try {
      const res = await createShiftsBulk(items)
      toast(`Создано записей: ${res.created}${res.skipped ? `, пропущено занятых дней: ${res.skipped}` : ''}`)
      close()
    } catch (e) { toast(errText(e), 'bad') } finally { setSaving(false) }
  }

  return (
    <Modal
      title="Повторяющиеся смены"
      subtitle="Создаются отдельные записи — каждую можно менять независимо"
      onClose={close}
      footer={<Button variant="primary" full loading={saving} disabled={!!rangeError || !!dayErr || workFree + offFree === 0} onClick={submit}>{workFree + offFree > 0 ? `Создать ${workFree + offFree} ${plural(workFree + offFree, ['запись', 'записи', 'записей'])}` : 'Нечего создавать'}</Button>}
    >
      <div className="space-y-5">
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-muted">График</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => setPresetId(p.id)} aria-pressed={presetId === p.id}
                className={clsx('rounded-2xl border px-3 py-2.5 text-left transition', presetId === p.id ? 'border-pink/60 bg-pink/10' : 'border-line bg-surface-2 hover:border-line-strong')}>
                <div className="text-[15px] font-semibold">{p.label}</div>
                <div className="text-xs text-muted">{p.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {presetId === 'cycle' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Рабочих дней подряд"><Input inputMode="numeric" value={work} onChange={(e) => setWork(e.target.value.replace(/\D/g, '').slice(0, 2))} /></Field>
            <Field label="Выходных дней подряд"><Input inputMode="numeric" value={off} onChange={(e) => setOff(e.target.value.replace(/\D/g, '').slice(0, 2))} /></Field>
          </div>
        )}
        {presetId === 'days' && (
          <div>
            <div className="flex gap-1.5">
              {WEEKDAYS.map((w, i) => {
                const n = i + 1; const on = days.includes(n)
                return <button key={w} type="button" onClick={() => setDays(on ? days.filter((d) => d !== n) : [...days, n])} aria-pressed={on}
                  className={clsx('h-11 flex-1 rounded-xl border text-[13px] font-semibold transition', on ? 'border-transparent bg-brand text-white' : 'border-line bg-surface-2 text-muted')}>{w}</button>
              })}
            </div>
            {dayErr && <p className="mt-1.5 text-xs text-bad">{dayErr}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="С даты"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} invalid={!!rangeError} /></Field>
          <Field label="По дату" error={rangeError}><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} invalid={!!rangeError} /></Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Начало"><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Конец"><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          <Field label="Перерыв, мин"><Input inputMode="numeric" value={breakMin} onChange={(e) => setBreakMin(e.target.value.replace(/\D/g, ''))} /></Field>
        </div>

        <Segmented value={payMode === 'manual' ? 'hourly' : payMode} onChange={setPayMode} options={(['hourly', 'fixed'] as PayMode[]).map((k) => ({ value: k, label: PAY_MODES[k].label }))} />
        {payMode === 'fixed' ? <Field label="Оплата за смену"><MoneyInput value={fixed} onChange={setFixed} /></Field> : <Field label="Ставка в час"><MoneyInput value={rate} onChange={setRate} /></Field>}

        <Switch checked={markOff} onChange={setMarkOff} label="Отметить остальные дни выходными" hint="Дни вне графика получат статус «Выходной»" />

        <Notice tone="info">
          {rangeError || dayErr ? 'Исправьте параметры, чтобы увидеть результат.' : (<>
            Смен будет создано: <b>{workFree}</b>{markOff && <>, выходных: <b>{offFree}</b></>}.
            {skipped > 0 && <> Дни, где запись уже есть, останутся без изменений ({skipped}).</>}
            {' '}Смены создаются как запланированные — после работы отметьте их отработанными.
          </>)}
        </Notice>
      </div>
    </Modal>
  )
}
