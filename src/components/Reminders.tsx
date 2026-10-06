import { AlertTriangle, BellRing, Clock } from 'lucide-react'
import type { Reminder } from '../lib/notifications/reminders'
import { useUI } from '../store/ui'

export function ReminderList({ items, max = 4 }: { items: Reminder[]; max?: number }) {
  const open = useUI((s) => s.open)
  if (!items.length) return null
  return (
    <div className="space-y-2">
      {items.slice(0, max).map((r) => {
        const bad = r.level === 'overdue'
        const warn = r.level === 'today' || r.level === 'soon'
        const color = bad ? '#fb5a6b' : warn ? '#fbbf24' : '#60a5fa'
        const Icon = bad ? AlertTriangle : warn ? BellRing : Clock
        return (
          <button key={r.key} onClick={() => open({ kind: 'payment', id: r.paymentId })} className="flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99]" style={{ borderColor: `${color}44`, background: `${color}12` }}>
            <Icon className="size-5 shrink-0" style={{ color }} />
            <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{r.title}</span><span className="block truncate text-xs text-muted">{r.text}</span></span>
          </button>
        )
      })}
      {items.length > max && <p className="px-1 text-xs text-faint">И ещё напоминаний: {items.length - max}</p>}
    </div>
  )
}
