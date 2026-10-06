import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PAYMENT_STATE_COLOR, PAYMENT_STATE_LABEL, paymentState } from '../lib/calc/loans'
import { monthGrid, WEEKDAYS } from '../lib/calendar/grid'
import { addMonthsStr, fmtDate, fmtMonthYear, monthKey, monthStart, parse } from '../lib/dates'
import { fmtCompact, fmtMoney } from '../lib/money'
import { useApp } from '../store/context'
import { useUI } from '../store/ui'
import type { LoanPayment, PaymentState } from '../types'
import { Row } from './Common'
import { Button, IconButton } from './ui/Button'
import { Card, Dot } from './ui/Card'

const LEGEND: PaymentState[] = ['upcoming', 'soon', 'paid', 'overdue', 'cancelled']

/** Календарь кредитных платежей: статус и сумма на каждой дате. Оплаченные показываются в день оплаты. */
export function PaymentsCalendar() {
  const { payments, loanById, today } = useApp()
  const open = useUI((s) => s.open)
  const [anchor, setAnchor] = useState(monthStart(today))
  const [sel, setSel] = useState<string | null>(null)

  const byDay = useMemo(() => {
    const map = new Map<string, LoanPayment[]>()
    for (const p of payments) {
      const l = loanById.get(p.loanId)
      if (!l || l.archived) continue
      const day = p.status === 'paid' && p.paidDate ? p.paidDate : p.plannedDate
      map.set(day, [...(map.get(day) ?? []), p])
    }
    return map
  }, [payments, loanById])

  const grid = useMemo(() => monthGrid(anchor), [anchor])
  const monthTotal = [...byDay.entries()].filter(([d]) => monthKey(d) === monthKey(anchor)).flatMap(([, v]) => v).filter((p) => p.status !== 'cancelled')
  const selected = sel ? byDay.get(sel) ?? [] : []

  const pick = (date: string) => {
    const list = byDay.get(date)
    if (!list?.length) { setSel(date); return }
    if (list.length === 1) open({ kind: 'payment', id: list[0].id! })
    else setSel(date)
  }

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <IconButton label="Предыдущий месяц" onClick={() => setAnchor(addMonthsStr(anchor, -1))}><ChevronLeft className="size-5" /></IconButton>
          <div className="text-center"><div className="text-base font-bold">{fmtMonthYear(anchor)}</div><div className="text-xs text-muted">платежей: {monthTotal.length} · {fmtMoney(monthTotal.reduce((a, p) => a + p.amount, 0))}</div></div>
          <IconButton label="Следующий месяц" onClick={() => setAnchor(addMonthsStr(anchor, 1))}><ChevronRight className="size-5" /></IconButton>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-faint">{WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((g) => {
            const list = byDay.get(g.date) ?? []
            const st = list[0] ? paymentState(list[0], today) : null
            const col = st ? PAYMENT_STATE_COLOR[st] : undefined
            const total = list.reduce((a, p) => a + p.amount, 0)
            return (
              <button key={g.date} onClick={() => pick(g.date)} aria-label={`${fmtDate(g.date)}${list.length ? `, платежей: ${list.length}` : ''}`}
                className={clsx('relative flex aspect-square min-h-12 flex-col items-center justify-between rounded-xl border p-1 text-[13px] transition active:scale-95 sm:min-h-16', g.inMonth ? 'border-line' : 'border-transparent opacity-35', g.date === today && 'ring-1 ring-pink/70', sel === g.date && 'bg-white/8')}
                style={col ? { background: `${col}1c`, borderColor: `${col}55` } : undefined}>
                <span className={clsx('self-start pl-0.5 font-medium', g.date === today ? 'text-pink' : 'text-ink')}>{parse(g.date).getDate()}</span>
                {list.length > 0 && <span className="text-[10px] font-bold leading-none tabular-nums sm:text-[11px]" style={{ color: col }}>{fmtCompact(total)}</span>}
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">{LEGEND.map((s) => <span key={s} className="flex items-center gap-1.5"><Dot color={PAYMENT_STATE_COLOR[s]} />{PAYMENT_STATE_LABEL[s]}</span>)}</div>
      </Card>

      {sel && (
        <Card>
          <div className="mb-2 text-sm font-semibold">{fmtDate(sel)}</div>
          {selected.length === 0 ? <p className="py-2 text-sm text-muted">В этот день платежей нет.</p> : (
            <div className="divide-y divide-line">
              {selected.map((p) => { const s = paymentState(p, today); return <Row key={p.id} chevron onClick={() => open({ kind: 'payment', id: p.id! })} title={loanById.get(p.loanId)?.name} sub={<span style={{ color: PAYMENT_STATE_COLOR[s] }}>{PAYMENT_STATE_LABEL[s]}{p.changed && s !== 'paid' ? ' · изменён' : ''}</span>} right={fmtMoney(p.amount)} /> })}
            </div>
          )}
        </Card>
      )}
      <div className="text-center"><Button size="sm" variant="ghost" onClick={() => { setAnchor(monthStart(today)); setSel(null) }}>К текущему месяцу</Button></div>
    </div>
  )
}
