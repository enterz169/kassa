import { BarChart3, ChevronRight, NotebookPen, Settings, Target, type LucideIcon } from 'lucide-react'
import { PageHeader } from '../components/Common'
import { Card } from '../components/ui/Card'
import { useUI } from '../store/ui'
import type { PageId } from '../types'

const ITEMS: { id: PageId; title: string; text: string; icon: LucideIcon; color: string }[] = [
  { id: 'analytics', title: 'Аналитика и отчёты', text: 'Графики, динамика, экспорт CSV и PDF', icon: BarChart3, color: '#60a5fa' },
  { id: 'notes', title: 'Заметки', text: 'Записи со ссылками на дни, смены и кредиты', icon: NotebookPen, color: '#c084fc' },
  { id: 'goals', title: 'Финансовые цели', text: 'Заработать, накопить, не превысить лимит', icon: Target, color: '#34d399' },
  { id: 'settings', title: 'Настройки', text: 'Ставка, уведомления, резервные копии', icon: Settings, color: '#ff7a1a' },
]

export function MorePage() {
  const go = useUI((s) => s.go)
  return (
    <>
      <PageHeader title="Ещё" />
      <div className="space-y-3">
        {ITEMS.map((it) => (
          <Card key={it.id} onClick={() => go(it.id)} className="flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-2xl" style={{ background: `${it.color}22`, color: it.color }}><it.icon className="size-6" /></span>
            <div className="min-w-0 flex-1"><div className="text-base font-semibold">{it.title}</div><div className="text-sm text-muted">{it.text}</div></div>
            <ChevronRight className="size-5 text-faint" />
          </Card>
        ))}
      </div>
    </>
  )
}
