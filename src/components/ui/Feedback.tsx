import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useUI } from '../../store/ui'
import { Button } from './Button'
import { Modal } from './Modal'

export function Toasts() {
  const toasts = useUI((s) => s.toasts)
  const dismiss = useUI((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center lg:items-end lg:pr-8 gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            'pointer-events-auto flex w-full max-w-md animate-toast-in items-center gap-3 rounded-2xl border bg-surface-2/95 px-4 py-3 text-sm shadow-xl backdrop-blur',
            t.tone === 'ok' && 'border-ok/30', t.tone === 'bad' && 'border-bad/40', t.tone === 'info' && 'border-info/30',
          )}
        >
          {t.tone === 'ok' ? <CheckCircle2 className="size-5 shrink-0 text-ok" /> : t.tone === 'bad' ? <AlertTriangle className="size-5 shrink-0 text-bad" /> : <Info className="size-5 shrink-0 text-info" />}
          <span className="min-w-0 flex-1">{t.text}</span>
          <button onClick={() => dismiss(t.id)} aria-label="Скрыть" className="text-faint hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function ConfirmDialog() {
  const c = useUI((s) => s.confirm)
  const close = useUI((s) => s.closeConfirm)
  const toast = useUI((s) => s.toast)
  if (!c) return null
  const run = async () => {
    try {
      await c.onConfirm()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось выполнить действие', 'bad')
    }
    close()
  }
  return (
    <div className="relative z-[60]">
      <Modal
        title={c.title}
        onClose={close}
        footer={
          <div className="flex gap-3">
            <Button full onClick={close}>Отмена</Button>
            <Button full variant={c.danger === false ? 'primary' : 'danger'} onClick={run}>{c.confirmLabel ?? 'Удалить'}</Button>
          </div>
        }
      >
        {c.text && <p className="text-[15px] leading-relaxed text-muted">{c.text}</p>}
      </Modal>
    </div>
  )
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-3xl border border-line bg-surface-2 text-pink [&>svg]:size-7">{icon}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      {text && <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Notice({ tone = 'info', children, className }: { tone?: 'info' | 'warn' | 'bad' | 'good'; children: ReactNode; className?: string }) {
  const c = { info: '#60a5fa', warn: '#fbbf24', bad: '#fb5a6b', good: '#34d399' }[tone]
  return (
    <div className={clsx('rounded-2xl border px-4 py-3 text-[13px] leading-relaxed', className)} style={{ borderColor: `${c}40`, background: `${c}12`, color: '#e9e9ee' }}>
      {children}
    </div>
  )
}
