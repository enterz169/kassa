import clsx from 'clsx'
import { BarChart3, CalendarDays, Ellipsis, Landmark, LayoutDashboard, NotebookPen, Plus, Settings, Target, Wallet, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useUI } from '../../store/ui'
import type { PageId } from '../../types'

interface Item { id: PageId; label: string; icon: LucideIcon }

const ALL: Item[] = [
  { id: 'home', label: 'Главная', icon: LayoutDashboard },
  { id: 'calendar', label: 'Календарь', icon: CalendarDays },
  { id: 'money', label: 'Доходы и расходы', icon: Wallet },
  { id: 'loans', label: 'Кредиты', icon: Landmark },
  { id: 'analytics', label: 'Аналитика', icon: BarChart3 },
  { id: 'notes', label: 'Заметки', icon: NotebookPen },
  { id: 'goals', label: 'Цели', icon: Target },
  { id: 'settings', label: 'Настройки', icon: Settings },
]

const MOBILE: Item[] = [
  { id: 'home', label: 'Главная', icon: LayoutDashboard },
  { id: 'calendar', label: 'Календарь', icon: CalendarDays },
  { id: 'money', label: 'Деньги', icon: Wallet },
  { id: 'loans', label: 'Кредиты', icon: Landmark },
  { id: 'more', label: 'Ещё', icon: Ellipsis },
]

const MORE_IDS: PageId[] = ['analytics', 'notes', 'goals', 'settings', 'more']

export function Shell({ children, alerts }: { children: ReactNode; alerts: number }) {
  const page = useUI((s) => s.page)
  const go = useUI((s) => s.go)
  const open = useUI((s) => s.open)

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-bg/60 px-4 py-6 backdrop-blur lg:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-brand glow text-lg font-black text-bg">К</div>
          <div><div className="text-[17px] font-extrabold tracking-tight">Касса</div><div className="text-xs text-faint">деньги, смены, кредиты</div></div>
        </div>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Разделы">
          {ALL.map((it) => {
            const active = page === it.id
            return (
              <button key={it.id} onClick={() => go(it.id)} aria-current={active ? 'page' : undefined}
                className={clsx('flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[15px] font-medium transition', active ? 'bg-white/8 text-ink' : 'text-muted hover:bg-white/5 hover:text-ink')}>
                <it.icon className={clsx('size-5', active && 'text-pink')} />
                <span className="flex-1 text-left">{it.label}</span>
                {it.id === 'loans' && alerts > 0 && <span className="rounded-full bg-bad px-2 py-0.5 text-xs font-bold text-white">{alerts}</span>}
              </button>
            )
          })}
        </nav>
        <button onClick={() => open({ kind: 'quick' })} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-white glow transition hover:brightness-110 active:scale-[0.98]"><Plus className="size-5" />Добавить</button>
      </aside>

      <main className="min-w-0 flex-1">
        <div key={page} className="mx-auto w-full max-w-5xl animate-page-in px-4 pb-40 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">{children}</div>
      </main>

      <button onClick={() => open({ kind: 'quick' })} aria-label="Добавить" className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex size-14 items-center justify-center rounded-full bg-brand text-white glow transition active:scale-95 lg:hidden"><Plus className="size-7" /></button>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Разделы">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {MOBILE.map((it) => {
            const active = it.id === 'more' ? MORE_IDS.includes(page) : page === it.id
            return (
              <button key={it.id} onClick={() => go(it.id)} aria-current={active ? 'page' : undefined} className="relative flex h-16 flex-col items-center justify-center gap-1">
                <span className={clsx('relative flex h-7 w-12 items-center justify-center rounded-full transition', active && 'bg-white/10')}>
                  <it.icon className={clsx('size-[22px] transition', active ? 'text-pink' : 'text-faint')} />
                  {it.id === 'loans' && alerts > 0 && <span className="absolute right-1 top-0 size-2.5 rounded-full bg-bad ring-2 ring-bg" />}
                </span>
                <span className={clsx('text-[11px] font-medium', active ? 'text-ink' : 'text-faint')}>{it.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
