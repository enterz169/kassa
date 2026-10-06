import clsx from 'clsx'
import type { HTMLAttributes, ReactNode } from 'react'

export function Card({ className, children, onClick, ...rest }: HTMLAttributes<HTMLDivElement>) {
  const clickable = !!onClick
  return (
    <div
      {...rest}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(e as never) } } : undefined}
      className={clsx('card-surface rounded-[1.25rem] p-4', clickable && 'cursor-pointer transition hover:border-line-strong active:scale-[0.99]', className)}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">{children}</h2>
      {action}
    </div>
  )
}

export function Badge({ color, children, className }: { color: string; children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium leading-none', className)} style={{ color, background: `${color}22` }}>
      {children}
    </span>
  )
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />
}

export function Progress({ value, color, height = 8, over }: { value: number; color?: string; height?: number; over?: boolean }) {
  const v = Math.min(100, Math.max(0, value))
  return (
    <div className="w-full overflow-hidden rounded-full bg-white/8" style={{ height }} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={clsx('h-full rounded-full transition-[width] duration-700 ease-out', !color && !over && 'bg-brand')}
        style={{ width: `${v}%`, background: over ? '#fb5a6b' : color }}
      />
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />
}
