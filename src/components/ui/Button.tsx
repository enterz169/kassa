import clsx from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  loading?: boolean
  full?: boolean
}

const V: Record<Variant, string> = {
  primary: 'bg-brand text-white glow hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface-3 border border-line-strong text-ink hover:bg-white/10',
  ghost: 'text-muted hover:text-ink hover:bg-white/5',
  danger: 'bg-bad/15 border border-bad/30 text-bad hover:bg-bad/25',
}
const S: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px] rounded-xl gap-1.5',
  md: 'h-11 px-5 text-[15px] rounded-2xl gap-2',
  lg: 'h-13 px-6 text-base rounded-2xl gap-2',
}

export function Button({ variant = 'secondary', size = 'md', icon, loading, full, className, children, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex select-none whitespace-nowrap items-center justify-center font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
        V[variant], S[size], full && 'w-full', className,
      )}
    >
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : icon}
      {children}
    </button>
  )
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={clsx('inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-white/8 hover:text-ink active:scale-95', className)}
    >
      {children}
    </button>
  )
}
