import { CalendarDays, Landmark, NotebookPen, Pin, PinOff, Plus, Receipt, Search, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../components/Common'
import { Button } from '../components/ui/Button'
import { Badge, Card } from '../components/ui/Card'
import { Input } from '../components/ui/Fields'
import { Empty } from '../components/ui/Feedback'
import { toggleNotePin } from '../db/notesGoals'
import { fmtDate } from '../lib/dates'
import { fmtMoney } from '../lib/money'
import { useApp } from '../store/context'
import { useUI } from '../store/ui'
import type { Note, NoteLink } from '../types'

export function NotesPage() {
  const { notes, txs, loanById } = useApp()
  const open = useUI((s) => s.open)
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const n = q.trim().toLowerCase()
    return notes.filter((x) => !n || x.title.toLowerCase().includes(n) || x.text.toLowerCase().includes(n)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
  }, [notes, q])

  const linkInfo = (l?: NoteLink): { icon: typeof Wallet; text: string; go: () => void } | null => {
    if (!l) return null
    if (l.type === 'day') return { icon: CalendarDays, text: `День ${fmtDate(l.date, 'd MMM yyyy')}`, go: () => open({ kind: 'shift', date: l.date }) }
    if (l.type === 'shift') return { icon: Wallet, text: `Смена ${fmtDate(l.date, 'd MMM yyyy')}`, go: () => open({ kind: 'shift', date: l.date }) }
    if (l.type === 'transaction') { const t = txs.find((x) => x.id === l.refId); return { icon: Receipt, text: t ? `${t.title} · ${fmtMoney(t.amount)}` : 'Запись удалена', go: () => t && open({ kind: 'tx', type: t.type, id: t.id }) } }
    const lo = loanById.get(l.refId)
    return { icon: Landmark, text: lo ? `Кредит «${lo.name}»` : 'Кредит удалён', go: () => lo && open({ kind: 'loanDetail', id: lo.id! }) }
  }

  const card = (n: Note) => {
    const li = linkInfo(n.link)
    return (
      <Card key={n.id} className="flex flex-col gap-3">
        <button className="text-left" onClick={() => open({ kind: 'note', id: n.id })}>
          <div className="flex items-start justify-between gap-2"><h3 className="min-w-0 break-words text-[16px] font-bold leading-snug">{n.title || 'Без названия'}</h3>{n.pinned && <Pin className="mt-1 size-4 shrink-0 text-pink" />}</div>
          {n.text && <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted">{n.text}</p>}
        </button>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          {li && <button onClick={li.go}><Badge color="#60a5fa" className="max-w-full"><li.icon className="size-3 shrink-0" /><span className="truncate">{li.text}</span></Badge></button>}
          <span className="text-xs text-faint">изм. {new Date(n.updatedAt).toLocaleDateString('ru-RU')}</span>
          <button onClick={() => toggleNotePin(n.id!)} className="ml-auto text-faint hover:text-ink" aria-label={n.pinned ? 'Открепить' : 'Закрепить'}>{n.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}</button>
        </div>
      </Card>
    )
  }

  return (
    <>
      <PageHeader title="Заметки" action={<Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => open({ kind: 'note' })}>Новая</Button>} />
      {notes.length > 0 && <div className="relative mb-4"><Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-faint" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по заметкам" className="pl-11" /></div>}
      {notes.length === 0 ? (
        <Card><Empty icon={<NotebookPen />} title="Заметок пока нет" text="Записывайте идеи и напоминания — и привязывайте их к дню, смене, расходу или кредиту." action={<Button variant="primary" onClick={() => open({ kind: 'note' })}>Создать заметку</Button>} /></Card>
      ) : list.length === 0 ? <Card><Empty icon={<Search />} title="Ничего не найдено" text="Попробуйте другой запрос." /></Card> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map(card)}</div>}
    </>
  )
}
