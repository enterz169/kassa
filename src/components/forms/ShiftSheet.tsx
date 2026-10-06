import clsx from 'clsx'
import { Plus, Repeat, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { deleteShift, saveShift } from '../../db/shifts'
import { savePreset } from '../../db/presets'
import { presetColor, presetOf } from '../../lib/templates'
import { CATEGORY_COLORS, SHIFT_STATUS, STATUS_ORDER, PAY_MODES } from '../../lib/constants'
import { calcHours, calcShiftPay } from '../../lib/calc/shifts'
import { fmtDate, fmtWeekday } from '../../lib/dates'
import { fmtHours, fmtMoney, parseMoney } from '../../lib/money'
import { useApp } from '../../store/context'
import { errText, useUI } from '../../store/ui'
import type { PayMode, ShiftStatus } from '../../types'
import { Button } from '../ui/Button'
import { Field, Input, MoneyInput, Segmented, Textarea } from '../ui/Fields'
import { Modal } from '../ui/Modal'
import { Notice } from '../ui/Feedback'

const strNum = (n: number | undefined) => (n ? String(n).replace('.', ',') : '')

export function ShiftSheet({ date }: { date: string }) {
  const { shifts, settings, templates, today } = useApp()
  const close = useUI((s) => s.close)
  const open = useUI((s) => s.open)
  const toast = useUI((s) => s.toast)
  const ask = useUI((s) => s.ask)
  const existing = useMemo(() => shifts.find((s) => s.date === date), [shifts, date])
  const st = settings!

  const [pick, setStatus] = useState<ShiftStatus | null>(existing?.status ?? null)
  const status: ShiftStatus = pick ?? 'dayoff'
  const [customLabel, setCustomLabel] = useState(existing?.customLabel ?? '')
  const [start, setStart] = useState(existing ? existing.start ?? '' : st.defaultStart)
  const [end, setEnd] = useState(existing ? existing.end ?? '' : st.defaultEnd)
  const [breakMin, setBreakMin] = useState(String(existing?.breakMin ?? st.defaultBreak))
  const [hoursStr, setHoursStr] = useState(() => (existing ? strNum(existing.hours) : strNum(calcHours(st.defaultStart, st.defaultEnd, st.defaultBreak) ?? 0)))
  const [hoursAuto, setHoursAuto] = useState(existing ? false : true)
  const [payMode, setPayMode] = useState<PayMode>(existing?.payMode ?? st.defaultPayMode)
  const [rate, setRate] = useState(strNum(existing ? existing.rate : st.defaultRate))
  const [fixedPay, setFixedPay] = useState(strNum(existing?.fixedPay))
  const [manualTotal, setManualTotal] = useState(strNum(existing?.manualTotal))
  const [tips, setTips] = useState(strNum(existing?.tips))
  const [bonus, setBonus] = useState(strNum(existing?.bonus))
  const [extra, setExtra] = useState(strNum(existing?.extra))
  const [note, setNote] = useState(existing?.note ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [color, setColor] = useState(existing?.color ?? CATEGORY_COLORS[0])

  /** Выбор статуса подставляет всё, что в нём сохранено раньше (кроме чаевых — они каждый раз разные). */
  const chooseStatus = (k: ShiftStatus, label?: string, col?: string) => {
    if (k === pick && (k !== 'custom' || label === customLabel)) return
    const wasWork = pick === 'work' || pick === 'planned'
    const t = presetOf(templates, k, st, label)
    setStatus(k); setErrors({})
    if (k === 'custom') { setCustomLabel(label ?? ''); setColor(col ?? t.color) }
    if (k === 'work' || k === 'planned') {
      if (wasWork && existing) return // уже работаем с этой сменой — введённое не трогаем
      setStart(t.start ?? ''); setEnd(t.end ?? ''); setBreakMin(String(t.breakMin)); setHoursStr(strNum(calcHours(t.start, t.end, t.breakMin) ?? 0)); setHoursAuto(true)
      setPayMode(t.payMode); setRate(strNum(t.rate)); setFixedPay(strNum(t.fixedPay)); setManualTotal(strNum(t.manualTotal))
      setTips(''); setBonus(strNum(t.bonus)); setExtra(strNum(t.extra))
      if (t.payMode !== 'manual') setTimeout(() => { const el = document.getElementById('shift-tips') as HTMLInputElement | null; el?.focus() }, 60)
    }
  }

  const customs = templates.filter((t) => t.status === 'custom')
  const works = pick === 'work' || pick === 'planned'
  const brk = Number.parseInt(breakMin || '0', 10)

  const recalc = (s: string, e: string, b: string) => {
    const h = calcHours(s || undefined, e || undefined, Number.parseInt(b || '0', 10) || 0)
    if (h !== null) setHoursStr(strNum(h))
  }

  const num = (v: string): number | null => (v.trim() === '' ? 0 : parseMoney(v))
  const hoursN = num(hoursStr)
  const preview = calcShiftPay({
    payMode, hours: hoursN ?? 0, rate: num(rate) ?? 0, fixedPay: num(fixedPay) ?? 0, manualTotal: num(manualTotal) ?? 0,
    tips: num(tips) ?? 0, bonus: num(bonus) ?? 0, extra: num(extra) ?? 0,
  })

  const submit = async () => {
    if (!pick) { toast('Выберите статус дня', 'bad'); return }
    const e: Record<string, string> = {}
    if (works) {
      if (hoursN === null || hoursN < 0 || hoursN > 24) e.hours = 'Часы: число от 0 до 24'
      if (!Number.isFinite(brk) || brk < 0 || brk > 600) e.breakMin = 'Перерыв в минутах: 0–600'
      if ((start && !end) || (!start && end)) e.time = 'Укажите и начало, и конец — или оставьте оба пустыми'
      if (payMode === 'hourly' && num(rate) === null) e.rate = 'Неверная ставка'
      if (payMode === 'fixed' && num(fixedPay) === null) e.fixedPay = 'Неверная сумма'
      if (payMode === 'manual' && (num(manualTotal) === null || num(manualTotal) === 0)) e.manualTotal = 'Введите итоговую сумму'
      if (payMode !== 'manual') {
        if (num(tips) === null) e.tips = 'Неверная сумма'
        if (num(bonus) === null) e.bonus = 'Неверная сумма'
        if (num(extra) === null) e.extra = 'Неверная сумма'
      }
    }
    if (status === 'custom' && !customLabel.trim()) e.customLabel = 'Назовите статус'
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      await saveShift({
        id: existing?.id, date, status: status === 'work' && date > today ? 'planned' : status,
        customLabel: status === 'custom' ? customLabel.trim() : undefined, color: status === 'custom' ? color : undefined,
        start: works && start ? start : undefined, end: works && end ? end : undefined,
        breakMin: works ? brk || 0 : 0, hours: works ? hoursN ?? 0 : 0, payMode,
        rate: works ? num(rate) ?? 0 : 0, fixedPay: works ? num(fixedPay) ?? 0 : 0, manualTotal: works ? num(manualTotal) ?? 0 : 0,
        tips: works && payMode !== 'manual' ? num(tips) ?? 0 : 0, bonus: works && payMode !== 'manual' ? num(bonus) ?? 0 : 0, extra: works && payMode !== 'manual' ? num(extra) ?? 0 : 0,
        note: note.trim() || undefined, seriesId: existing?.seriesId,
      })
      await savePreset({
        status, color: status === 'custom' ? color : SHIFT_STATUS[status].color, customLabel: status === 'custom' ? customLabel.trim() : undefined,
        start: works && start ? start : undefined, end: works && end ? end : undefined, breakMin: works ? brk || 0 : 0, payMode,
        rate: works ? num(rate) ?? 0 : 0, fixedPay: works ? num(fixedPay) ?? 0 : 0, manualTotal: works ? num(manualTotal) ?? 0 : 0,
        tips: 0, bonus: works && payMode !== 'manual' ? num(bonus) ?? 0 : 0, extra: works && payMode !== 'manual' ? num(extra) ?? 0 : 0,
      })
      toast(existing ? 'Изменения сохранены' : 'Запись добавлена')
      close()
    } catch (err) {
      toast(errText(err), 'bad')
    } finally {
      setSaving(false)
    }
  }

  const remove = () =>
    ask({
      title: 'Удалить запись за этот день?',
      text: `${fmtDate(date)} — ${SHIFT_STATUS[existing!.status].label.toLowerCase()}. Остальные дни серии не изменятся.`,
      onConfirm: async () => { await deleteShift(existing!.id!); toast('Запись удалена'); close() },
    })

  return (
    <Modal
      title={fmtDate(date)}
      subtitle={fmtWeekday(date)}
      onClose={close}
      footer={
        <div className="flex gap-3">
          {existing && <Button variant="danger" onClick={remove} aria-label="Удалить" icon={<Trash2 className="size-4" />} />}
          <Button variant="primary" full loading={saving} disabled={!pick} onClick={submit}>{existing ? 'Сохранить' : 'Добавить'}</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-muted">Статус дня</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STATUS_ORDER.filter((k) => k !== 'custom').map((k) => (
              <StatusBtn key={k} active={pick === k} color={SHIFT_STATUS[k].color} label={SHIFT_STATUS[k].short} onClick={() => chooseStatus(k)} />
            ))}
            {customs.map((t) => (
              <StatusBtn key={t.id} active={pick === 'custom' && customLabel.trim().toLowerCase() === (t.customLabel ?? '').toLowerCase()} color={presetColor(t)} label={t.customLabel ?? 'Свой'} onClick={() => chooseStatus('custom', t.customLabel, t.color)} />
            ))}
            <button type="button" onClick={() => { setStatus('custom'); setCustomLabel(''); setErrors({}) }} aria-pressed={pick === 'custom' && !customs.some((t) => (t.customLabel ?? '').toLowerCase() === customLabel.trim().toLowerCase())} className="flex h-11 items-center gap-2 rounded-2xl border border-dashed border-line-strong px-3 text-[13px] font-medium text-muted hover:text-ink"><Plus className="size-4" />Свой статус</button>
          </div>
          <p className="mt-1.5 text-xs text-faint">{pick ? 'Что заполните ниже — запомнится в этом статусе и подставится в следующий раз.' : 'Выберите статус — сохранённые в нём данные подставятся сами.'}</p>
        </div>

        {status === 'custom' && (
          <div className="space-y-3">
            <Field label="Название статуса" error={errors.customLabel}><Input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="Например, командировка" maxLength={30} invalid={!!errors.customLabel} /></Field>
            <div className="flex flex-wrap gap-2">{CATEGORY_COLORS.map((c) => <button key={c} type="button" aria-label={`Цвет ${c}`} onClick={() => setColor(c)} className="size-8 rounded-full" style={{ background: c, boxShadow: color === c ? `0 0 0 2px #111114, 0 0 0 4px ${c}` : undefined }} />)}</div>
          </div>
        )}

        {works && (
          <>
            {status === 'planned' && <Notice tone="info">Запланированная смена пока не входит в доход. После работы отметьте её «Рабочей сменой».</Notice>}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Начало"><Input type="time" value={start} onChange={(e) => { setStart(e.target.value); if (hoursAuto) recalc(e.target.value, end, breakMin) }} invalid={!!errors.time} /></Field>
              <Field label="Конец"><Input type="time" value={end} onChange={(e) => { setEnd(e.target.value); if (hoursAuto) recalc(start, e.target.value, breakMin) }} invalid={!!errors.time} /></Field>
              <Field label="Перерыв, мин" error={errors.breakMin}><Input inputMode="numeric" value={breakMin} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setBreakMin(v); if (hoursAuto) recalc(start, end, v) }} invalid={!!errors.breakMin} /></Field>
            </div>
            {errors.time && <p className="-mt-3 text-xs text-bad">{errors.time}</p>}

            <Field label="Отработано часов" error={errors.hours} hint={hoursAuto ? 'Считается автоматически: конец − начало − перерыв' : undefined}>
              <div className="flex gap-2">
                <Input inputMode="decimal" value={hoursStr} onChange={(e) => { setHoursStr(e.target.value.replace(/[^\d.,]/g, '')); setHoursAuto(false) }} invalid={!!errors.hours} />
                {!hoursAuto && <Button size="md" onClick={() => { setHoursAuto(true); recalc(start, end, breakMin) }}>Авто</Button>}
              </div>
            </Field>

            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-muted">Как считать заработок</span>
              <Segmented value={payMode} onChange={setPayMode} options={(Object.keys(PAY_MODES) as PayMode[]).map((k) => ({ value: k, label: PAY_MODES[k].label }))} />
              <p className="mt-1.5 text-xs text-faint">{PAY_MODES[payMode].hint}</p>
            </div>

            {payMode === 'hourly' && <Field label="Ставка в час" error={errors.rate}><MoneyInput value={rate} onChange={setRate} invalid={!!errors.rate} /></Field>}
            {payMode === 'fixed' && <Field label="Оплата за смену" error={errors.fixedPay}><MoneyInput value={fixedPay} onChange={setFixedPay} invalid={!!errors.fixedPay} /></Field>}
            {payMode === 'manual' && <Field label="Итоговая сумма за смену" error={errors.manualTotal} hint="Чаевые и бонусы уже должны быть внутри — отдельно они не добавляются."><MoneyInput value={manualTotal} onChange={setManualTotal} invalid={!!errors.manualTotal} /></Field>}

            {payMode !== 'manual' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Чаевые" error={errors.tips}><MoneyInput id="shift-tips" value={tips} onChange={setTips} invalid={!!errors.tips} /></Field>
                <Field label="Бонусы и премии" error={errors.bonus}><MoneyInput value={bonus} onChange={setBonus} invalid={!!errors.bonus} /></Field>
                <Field label="Доп. заработок" error={errors.extra}><MoneyInput value={extra} onChange={setExtra} invalid={!!errors.extra} /></Field>
              </div>
            )}

            <div className="rounded-2xl border border-line bg-surface-2 p-4">
              <div className="space-y-1.5 text-sm">
                {payMode === 'hourly' && <Line k={`${fmtHours(hoursN ?? 0)} × ${fmtMoney(num(rate) ?? 0)}`} v={preview.base} />}
                {payMode === 'fixed' && <Line k="Оплата за смену" v={preview.base} />}
                {payMode === 'manual' && <Line k="Итого вручную" v={preview.base} />}
                {preview.tips > 0 && <Line k="Чаевые" v={preview.tips} />}
                {preview.bonus > 0 && <Line k="Бонусы" v={preview.bonus} />}
                {preview.extra > 0 && <Line k="Доп. заработок" v={preview.extra} />}
              </div>
              <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
                <span className="text-sm text-muted">Итого за смену</span>
                <span className="text-brand text-2xl font-extrabold tabular-nums">{fmtMoney(preview.total)}</span>
              </div>
            </div>
          </>
        )}

        {pick && <Field label="Заметка"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Необязательно" maxLength={500} /></Field>}

        {existing?.seriesId && <Notice tone="info">Эта запись создана повторением. Изменения касаются только этого дня — остальные дни серии не меняются.</Notice>}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<Repeat className="size-4" />} onClick={() => open({ kind: 'recurring', date })}>Повторяющиеся смены</Button>
          {existing && <Button size="sm" onClick={() => open({ kind: 'note', link: { type: 'shift', refId: existing.id!, date } })}>Заметка к смене</Button>}
        </div>
      </div>
    </Modal>
  )
}

function StatusBtn({ active, color, label, onClick }: { active: boolean; color: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={clsx('flex h-11 items-center gap-2 rounded-2xl border px-3 text-left text-[13px] font-medium transition active:scale-95', active ? 'border-transparent text-white' : 'border-line bg-surface-2 text-muted hover:text-ink')}
      style={active ? { background: `${color}33`, boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}>
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate">{label}</span>
    </button>
  )
}

function Line({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between text-muted">
      <span>{k}</span>
      <span className="font-medium text-ink tabular-nums">{fmtMoney(v)}</span>
    </div>
  )
}
