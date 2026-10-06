import clsx from 'clsx'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from './ui/Card'

export function StatCard({ label, value, sub, icon: Icon, tone, onClick, big }: {
  label: string; value: ReactNode; sub?: ReactNode; icon?: LucideIcon; tone?: 'ok' | 'bad' | 'warn' | 'brand'; onClick?: () => void; big?: boolean
}) {
  const color = tone === 'ok' ? 'text-ok' : tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ink'
  return (
    <Card onClick={onClick} className="relative min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] text-muted">{label}</span>
        {Icon && <Icon className="size-4 shrink-0 text-faint" />}
      </div>
      <div className={clsx('mt-2 truncate font-bold tracking-tight tabular-nums', big ? 'text-[28px]' : 'text-xl', tone === 'brand' ? 'text-brand' : color)}>{value}</div>
      {sub && <div className="mt-1 truncate text-xs text-faint">{sub}</div>}
    </Card>
  )
}

export function Row({ left, title, sub, right, rightSub, onClick, chevron }: {
  left?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; rightSub?: ReactNode; onClick?: () => void; chevron?: boolean
}) {
  const inner = (
    <>
      {left}
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-[15px] font-medium text-ink">{title}</div>
        {sub && <div className="mt-0.5 truncate text-xs text-muted">{sub}</div>}
      </div>
      {(right || rightSub) && (
        <div className="shrink-0 text-right">
          <div className="text-[15px] font-semibold tabular-nums">{right}</div>
          {rightSub && <div className="mt-0.5 text-xs text-faint">{rightSub}</div>}
        </div>
      )}
      {chevron && <ChevronRight className="size-4 shrink-0 text-faint" />}
    </>
  )
  const cls = 'flex min-h-14 w-full items-center gap-3 px-1 py-2.5'
  return onClick ? <button type="button" onClick={onClick} className={clsx(cls, 'rounded-xl transition hover:bg-white/4 active:bg-white/6')}>{inner}</button> : <div className={cls}>{inner}</div>
}

export function Avatar({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl text-[15px] [&>svg]:size-[18px]" style={{ background: `${color}22`, color }}>
      {children}
    </span>
  )
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-[26px] font-extrabold tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export function Divider() {
  return <div className="my-1 h-px bg-line" />
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'ok' | 'bad' | 'warn' }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs text-muted">{label}</div>
      <div className={clsx('mt-0.5 truncate text-[15px] font-semibold tabular-nums', tone === 'ok' && 'text-ok', tone === 'bad' && 'text-bad', tone === 'warn' && 'text-warn')}>{value}</div>
    </div>
  )
}
