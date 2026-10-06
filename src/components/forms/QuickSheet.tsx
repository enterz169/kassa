import { CalendarDays, CreditCard, NotebookPen, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { todayStr } from '../../lib/dates'
import { useUI, type Sheet } from '../../store/ui'
import { Modal } from '../ui/Modal'

export function QuickSheet() {
  const close = useUI((s) => s.close)
  const open = useUI((s) => s.open)
  const items: { icon: LucideIcon; title: string; text: string; color: string; sheet: Sheet }[] = [
    { icon: CalendarDays, title: 'Смена', text: 'Отметить рабочий день', color: '#34d399', sheet: { kind: 'shift', date: todayStr() } },
    { icon: TrendingUp, title: 'Доход', text: 'Подработка, зарплата', color: '#60a5fa', sheet: { kind: 'tx', type: 'income' } },
    { icon: TrendingDown, title: 'Расход', text: 'Покупка или оплата', color: '#ff5a7a', sheet: { kind: 'tx', type: 'expense' } },
    { icon: CreditCard, title: 'Кредит', text: 'Кредит, заём, рассрочка', color: '#ff7a1a', sheet: { kind: 'loan' } },
    { icon: NotebookPen, title: 'Заметка', text: 'Мысль или напоминание', color: '#c084fc', sheet: { kind: 'note' } },
  ]
  return (
    <Modal title="Добавить" onClose={close}>
      <div className="grid grid-cols-2 gap-3">
        {items.map((it, i) => (
          <button key={it.title} onClick={() => open(it.sheet)} className={`flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface-2 p-4 text-left transition hover:border-line-strong active:scale-[0.98] ${i === 4 ? 'col-span-2' : ''}`}>
            <span className="flex size-11 items-center justify-center rounded-2xl" style={{ background: `${it.color}22`, color: it.color }}><it.icon className="size-5" /></span>
            <span><span className="block text-[15px] font-semibold">{it.title}</span><span className="block text-xs text-muted">{it.text}</span></span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
