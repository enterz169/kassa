import clsx from 'clsx'
import { CalendarCheck2, ChevronLeft, ChevronRight, ListChecks, Repeat, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader, Stat } from '../components/Common'
import { PaymentsCalendar } from '../components/PaymentsCalendar'
import { Button, IconButton } from '../components/ui/Button'
import { Card, Dot } from '../components/ui/Card'
import { Segmented } from '../components/ui/Fields'
import { Notice } from '../components/ui/Feedback'
import { confirmPastPlanned, createShiftsBulk, deleteShiftsOnDates } from '../db/shifts'
import { hasPreset, presetColor, presetOf, shiftFromPreset } from '../lib/templates'
import type { ShiftStatus } from '../types'
import { calcShiftPay } from '../lib/calc/shifts'
import { shiftStats } from '../lib/calc/finance'
import { monthGrid, WEEKDAYS } from '../lib/calendar/grid'
import { SHIFT_STATUS, STATUS_ORDER } from '../lib/constants'
import { addMonthsStr, fmtMonthYear, monthEnd, monthStart, parse } from '../lib/dates'
import { fmtCompact, fmtHours, fmtMoney, plural } from '../lib/money'
import { useApp } from '../store/context'
import { errText, useUI } from '../store/ui'

function PickBtn({ color, label, disabled, onClick }: { color: string; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-line bg-surface px-4 text-[13px] font-semibold transition active:scale-95 disabled:opacity-40" style={{ boxShadow: `inset 0 0 0 1.5px ${color}66` }}>
      <span className="size-2.5 rounded-full" style={{ background: color }} />{label}
    </button>
  )
}

type View = 'shifts' | 'payments'

export function CalendarPage() {
  const { shifts, payments, loanById, templates, settings, today } = useApp()
  const open = useUI((s) => s.open)
  const toast = useUI((s) => s.toast)
  const ask = useUI((s) => s.ask)
  const [view, setView] = useState<View>('shifts')
  const [anchor, setAnchor] = useState(monthStart(today))
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<string[]>([])

  const byDate = useMemo(() => new Map(shifts.map((s) => [s.date, s])), [shifts])
  const payDays = useMemo(() => {
    const set = new Set<string>()
    for (const p of payments) if (p.status === 'planned' && !loanById.get(p.loanId)?.archived) set.add(p.plannedDate)
    return set
  }, [payments, loanById])
  const grid = useMemo(() => monthGrid(anchor), [anchor])
  const stats = useMemo(() => shiftStats(shifts, { from: monthStart(anchor), to: monthEnd(anchor) }), [shifts, anchor])
  const stale = useMemo(() => shifts.filter((s) => s.status === 'planned' && s.date <= today).length, [shifts, today])
  const plannedCount = useMemo(() => shifts.filter((s) => s.status === 'planned' && s.date >= monthStart(anchor) && s.date <= monthEnd(anchor)).length, [shifts, anchor])

  const onDay = (date: string) => {
    if (!selecting) { open({ kind: 'shift', date }); return }
    setPicked((p) => (p.includes(date) ? p.filter((d) => d !== date) : [...p, date]))
  }
  const stopSelecting = () => { setSelecting(false); setPicked([]) }

  /** Применить статус (с сохранёнными в нём данными) ко всем выбранным дням сразу. */
  const applyToPicked = async (status: ShiftStatus, label?: string) => {
    if (!picked.length || !settings) return
    if (status === 'work' && !hasPreset(templates, 'work')) { const d = picked; stopSelecting(); open({ kind: 'multi', dates: d }); return }
    const t = presetOf(templates, status, settings, label)
    try {
      const res = await createShiftsBulk(picked.map((d) => shiftFromPreset(t, d, today)))
      const name = status === 'custom' ? label : SHIFT_STATUS[status].label
      toast(res.skipped ? `${name}: добавлено ${res.created}, пропущено занятых дней: ${res.skipped}` : `${name}: ${res.created} ${plural(res.created, ['день', 'дня', 'дней'])}`)
      stopSelecting()
    } catch (e) { toast(errText(e), 'bad') }
  }

  const clearPicked = () => {
    const days = picked.filter((d) => byDate.has(d))
    if (!days.length) return
    ask({ title: `Очистить дни: ${days.length}?`, text: 'У выбранных дней будут удалены записи (смены, выходные). Доход по ним пересчитается.', confirmLabel: 'Очистить',
      onConfirm: async () => { const n = await deleteShiftsOnDates(days); toast(`Очищено дней: ${n}`); stopSelecting() } })
  }

  const confirm = async () => {
    try { const n = await confirmPastPlanned(today); toast(`Отмечено отработанными: ${n}`) } catch (e) { toast(errText(e), 'bad') }
  }

  return (
    <>
      <PageHeader title="Календарь" sub={view === 'shifts' ? (selecting ? 'Режим выбора дней' : 'Нажмите на день, чтобы добавить смену') : 'Платежи по кредитам'} action={view === 'shifts' ? <div className="flex gap-2"><Button size="sm" icon={<ListChecks className="size-4" />} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>{selecting ? 'Отмена' : 'Выбрать дни'}</Button><Button size="sm" icon={<Repeat className="size-4" />} onClick={() => open({ kind: 'recurring' })}>График</Button></div> : undefined} />
      <Segmented className="mb-4" value={view} onChange={setView} options={[{ value: 'shifts', label: 'Смены' }, { value: 'payments', label: 'Платежи по кредитам' }]} />

      {selecting && view === 'shifts' && (
        <div className="sticky top-2 z-30 mb-4 space-y-2.5 rounded-2xl border border-line-strong bg-surface-2/95 p-3 shadow-2xl backdrop-blur" role="region" aria-label="Выбор статуса для дней">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1 pl-1 text-sm">{picked.length ? `Выбрано дней: ${picked.length}. Нажмите статус — он применится сразу` : '1. Отметьте дни в календаре. 2. Нажмите статус'}</span>
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
            {(['work', 'dayoff', 'holiday', 'sick', 'vacation'] as ShiftStatus[]).map((k) => (
              <PickBtn key={k} disabled={!picked.length} color={SHIFT_STATUS[k].color} label={SHIFT_STATUS[k].short} onClick={() => applyToPicked(k)} />
            ))}
            {templates.filter((t) => t.status === 'custom').map((t) => (
              <PickBtn key={t.id} disabled={!picked.length} color={presetColor(t)} label={t.customLabel ?? 'Свой'} onClick={() => applyToPicked('custom', t.customLabel)} />
            ))}
            <button type="button" disabled={!picked.some((d) => byDate.has(d))} onClick={clearPicked} className="flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-bad/40 px-4 text-[13px] font-semibold text-bad transition active:scale-95 disabled:opacity-40"><Trash2 className="size-4" />Очистить дни</button>
          </div>
        </div>
      )}
      {view === 'payments' ? <PaymentsCalendar /> : (
        <div className="space-y-4">
          {stale > 0 && (
            <Notice tone="warn">
              <div className="flex items-center justify-between gap-3">
                <span>Прошедших запланированных смен: <b>{stale}</b>. Пока они не учтены в доходе.</span>
                <Button size="sm" variant="primary" icon={<CalendarCheck2 className="size-4" />} onClick={confirm}>Отработаны</Button>
              </div>
            </Notice>
          )}
          <Card className="p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <IconButton label="Предыдущий месяц" onClick={() => setAnchor(addMonthsStr(anchor, -1))}><ChevronLeft className="size-5" /></IconButton>
              <button onClick={() => setAnchor(monthStart(today))} className="text-center" aria-label="Перейти к текущей дате">
                <div className="text-base font-bold">{fmtMonthYear(anchor)}</div>
                <div className="text-xs text-pink">{anchor === monthStart(today) ? 'текущий месяц' : 'к сегодняшнему дню'}</div>
              </button>
              <IconButton label="Следующий месяц" onClick={() => setAnchor(addMonthsStr(anchor, 1))}><ChevronRight className="size-5" /></IconButton>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-faint">{WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}</div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((g) => {
                const s = byDate.get(g.date)
                const base = s ? SHIFT_STATUS[s.status] : null
                const meta = base && s ? { ...base, color: s.color ?? base.color } : null
                const worked = s?.status === 'work'
                const label = s?.status === 'custom' && s.customLabel ? s.customLabel : meta?.short
                const total = s ? calcShiftPay(s).total : 0
                return (
                  <button key={g.date} onClick={() => onDay(g.date)}
                    aria-label={`${g.date}${meta ? `, ${meta.label}` : ', нет записи'}`}
                    className={clsx('relative flex aspect-[4/5] min-h-14 flex-col justify-between overflow-hidden rounded-xl border p-1 text-left transition active:scale-95 sm:aspect-square sm:min-h-[4.5rem] sm:p-1.5', g.inMonth ? 'border-line' : 'border-transparent opacity-35', g.date === today && 'ring-1 ring-pink/70', picked.includes(g.date) && 'outline-2 outline-pink -outline-offset-2')}
                    style={meta ? { background: `${meta.color}${s!.status === 'planned' ? '12' : '20'}`, borderColor: `${meta.color}${s!.status === 'planned' ? '66' : '55'}`, borderStyle: s!.status === 'planned' ? 'dashed' : 'solid' } : undefined}>
                    <span className="flex items-start justify-between">
                      <span className={clsx('pl-0.5 text-[13px] font-semibold', g.date === today ? 'text-pink' : 'text-ink')}>{parse(g.date).getDate()}</span>
                      {payDays.has(g.date) && <span className="mr-0.5 mt-0.5 size-1.5 rounded-full bg-pink" title="Платёж по кредиту" />}
                    </span>
                    {s && (
                      <span className="block min-w-0">
                        {(s.status === 'work' || s.status === 'planned') ? (
                          <>
                            <span className="block truncate text-[10px] font-bold leading-tight tabular-nums sm:text-[11px]" style={{ color: meta!.color }}>{worked ? fmtCompact(total) : s.hours ? `${s.hours} ч` : meta!.short}</span>
                            {worked && s.hours > 0 && <span className="hidden truncate text-[10px] text-muted sm:block">{s.hours} ч</span>}
                          </>
                        ) : <span className="block truncate text-[10px] font-medium leading-tight" style={{ color: meta!.color }}>{label}</span>}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
              {STATUS_ORDER.map((k) => <span key={k} className="flex items-center gap-1.5"><Dot color={SHIFT_STATUS[k].color} />{SHIFT_STATUS[k].label}</span>)}
              <span className="flex items-center gap-1.5"><Dot color="#ff3d7f" size={6} />платёж по кредиту</span>
            </div>
          </Card>

          <Card>
            <div className="mb-3 text-sm font-semibold">{fmtMonthYear(anchor)}: итоги</div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Отработано смен" value={String(stats.count)} />
              <Stat label="Часов" value={fmtHours(stats.hours)} />
              <Stat label="Заработано" value={fmtMoney(stats.earned)} tone="ok" />
              <Stat label="Средний за смену" value={stats.count ? fmtMoney(stats.avgPerShift) : '—'} />
            </div>
            {plannedCount > 0 && <p className="mt-3 text-xs text-faint">Запланировано ещё {plannedCount} {plural(plannedCount, ['смена', 'смены', 'смен'])} — они войдут в доход после отметки «Рабочая смена».</p>}
          </Card>
        </div>
      )}
    </>
  )
}
