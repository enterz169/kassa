import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const base =
  'w-full rounded-2xl border bg-surface-2 px-4 text-ink outline-none transition placeholder:text-faint focus:border-pink/60 focus:ring-4 focus:ring-pink/10 disabled:opacity-50'

export function Field({ label, hint, error, children, className }: { label?: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      {label && <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>}
      {children}
      {error ? <span className="mt-1.5 block text-xs text-bad">{error}</span> : hint ? <span className="mt-1.5 block text-xs text-faint">{hint}</span> : null}
    </label>
  )
}

export function Input({ invalid, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...rest} className={clsx(base, 'h-12', invalid ? 'border-bad/60' : 'border-line', className)} />
}

export function MoneyInput({ invalid, className, value, onChange, placeholder = '0', ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { invalid?: boolean; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <input
        {...rest}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,\s]/g, ''))}
        className={clsx(base, 'h-12 pr-10 tabular-nums', invalid ? 'border-bad/60' : 'border-line', className)}
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted">₽</span>
    </div>
  )
}

export function Select({ className, children, invalid, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select {...rest} className={clsx(base, 'h-12 appearance-none pr-10', invalid ? 'border-bad/60' : 'border-line', className)}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  )
}

export function Textarea({ className, invalid, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea {...rest} className={clsx(base, 'min-h-24 resize-y py-3 leading-relaxed', invalid ? 'border-bad/60' : 'border-line', className)} />
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 py-2 text-left">
      <span>
        <span className="block text-[15px] text-ink">{label}</span>
        {hint && <span className="block text-xs text-faint">{hint}</span>}
      </span>
      <span className={clsx('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-brand' : 'bg-white/12')}>
        <span className={clsx('absolute top-0.5 size-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
    </button>
  )
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div className={clsx('flex rounded-2xl border border-line bg-surface-2 p-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx('h-9 flex-1 rounded-xl px-3 text-[13px] font-semibold whitespace-nowrap transition', value === o.value ? 'bg-brand text-white glow' : 'text-muted hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={clsx('h-9 shrink-0 rounded-full border px-4 text-[13px] font-medium transition', value === o.value ? 'border-transparent bg-brand text-white' : 'border-line bg-surface-2 text-muted hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
