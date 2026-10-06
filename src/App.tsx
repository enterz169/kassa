import { useEffect, useMemo, useState } from 'react'
import { CategoriesSheet } from './components/forms/CategoriesSheet'
import { DrillSheet } from './components/forms/DrillSheet'
import { GoalSheet } from './components/forms/GoalSheet'
import { LoanDetailSheet } from './components/forms/LoanDetailSheet'
import { LoanSheet } from './components/forms/LoanSheet'
import { MultiShiftSheet } from './components/forms/MultiShiftSheet'
import { NoteSheet } from './components/forms/NoteSheet'
import { PaymentSheet } from './components/forms/PaymentSheet'
import { QuickSheet } from './components/forms/QuickSheet'
import { RecurringSheet } from './components/forms/RecurringSheet'
import { ShiftSheet } from './components/forms/ShiftSheet'
import { TxSheet } from './components/forms/TxSheet'
import { Shell } from './components/layout/Shell'
import { ConfirmDialog, Toasts } from './components/ui/Feedback'
import { Skeleton } from './components/ui/Card'
import { ensureAllSchedules } from './db/loans'
import { ensureSeed } from './db/settings'
import { applyTheme } from './lib/theme'
import { computeReminders } from './lib/notifications/reminders'
import { fireDue } from './lib/notifications/local'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { CalendarPage } from './pages/CalendarPage'
import { GoalsPage } from './pages/GoalsPage'
import { HomePage } from './pages/HomePage'
import { LoansPage } from './pages/LoansPage'
import { MoneyPage } from './pages/MoneyPage'
import { MorePage } from './pages/MorePage'
import { NotesPage } from './pages/NotesPage'
import { SettingsPage } from './pages/SettingsPage'
import { DataProvider, useApp } from './store/context'
import { useUI } from './store/ui'

function SheetHost() {
  const sheet = useUI((s) => s.sheet)
  if (!sheet) return null
  switch (sheet.kind) {
    case 'quick': return <QuickSheet />
    case 'shift': return <ShiftSheet key={sheet.date} date={sheet.date} />
    case 'recurring': return <RecurringSheet date={sheet.date} />
    case 'multi': return <MultiShiftSheet dates={sheet.dates} />
    case 'tx': return <TxSheet key={`${sheet.type}-${sheet.id ?? 'new'}`} type={sheet.type} id={sheet.id} />
    case 'loan': return <LoanSheet key={sheet.id ?? 'new'} id={sheet.id} />
    case 'loanDetail': return <LoanDetailSheet key={sheet.id} id={sheet.id} />
    case 'payment': return <PaymentSheet key={sheet.id} id={sheet.id} />
    case 'note': return <NoteSheet key={sheet.id ?? 'new'} id={sheet.id} link={sheet.link} />
    case 'goal': return <GoalSheet key={sheet.id ?? 'new'} id={sheet.id} />
    case 'categories': return <CategoriesSheet type={sheet.type} />
    case 'drill': return <DrillSheet title={sheet.title} categoryId={sheet.categoryId} from={sheet.from} to={sheet.to} txType={sheet.txType} />
  }
}

function Pages() {
  const page = useUI((s) => s.page)
  switch (page) {
    case 'home': return <HomePage />
    case 'calendar': return <CalendarPage />
    case 'money': return <MoneyPage />
    case 'loans': return <LoansPage />
    case 'analytics': return <AnalyticsPage />
    case 'notes': return <NotesPage />
    case 'goals': return <GoalsPage />
    case 'settings': return <SettingsPage />
    case 'more': return <MorePage />
  }
}

function Inner() {
  const { ready, loans, payments, today, settings } = useApp()
  const theme = settings?.theme
  useEffect(() => { applyTheme(theme) }, [theme])
  const reminders = useMemo(() => computeReminders(loans, payments, today), [loans, payments, today])
  const alerts = reminders.filter((r) => r.level === 'overdue' || r.level === 'today' || r.level === 'soon').length

  // Локальные уведомления: только пока приложение открыто, не чаще раза в день на платёж.
  useEffect(() => {
    if (!ready) return
    const tick = () => {
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      if (hhmm >= (settings?.remindTime ?? '09:00')) fireDue(reminders, today)
    }
    tick()
    const id = setInterval(tick, 5 * 60_000)
    return () => clearInterval(id)
  }, [ready, reminders, today, settings?.remindTime])

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-10 w-2/3" /><Skeleton className="h-40" /><div className="grid grid-cols-2 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      </div>
    )
  }
  return (
    <>
      <Shell alerts={alerts}><Pages /></Shell>
      <SheetHost />
      <ConfirmDialog />
      <Toasts />
    </>
  )
}

export default function App() {
  const [boot, setBoot] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState('')
  useEffect(() => {
    ;(async () => {
      try {
        await ensureSeed(); await ensureAllSchedules(); setBoot('ok')
        // Ярлыки с иконки приложения: ?go=calendar, ?go=expense
        const go = new URLSearchParams(location.search).get('go')
        if (go === 'calendar') useUI.getState().go('calendar')
        else if (go === 'expense') useUI.getState().open({ kind: 'tx', type: 'expense' })
      }
      catch (e) { setMessage(e instanceof Error ? e.message : String(e)); setBoot('error') }
    })()
  }, [])
  if (boot === 'error') {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-bold">Не удалось открыть хранилище</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">Приложению нужна база IndexedDB в браузере. Возможно, включён приватный режим или хранилище сайта заблокировано. Разрешите хранение данных и обновите страницу.</p>
        <p className="mt-3 text-xs text-faint">{message}</p>
      </div>
    )
  }
  if (boot === 'loading') return <div className="mx-auto max-w-3xl space-y-4 p-6"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40" /></div>
  return <DataProvider><Inner /></DataProvider>
}
