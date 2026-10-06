import { Check, Pencil, Plus, RotateCcw, Target } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader, Stat } from '../components/Common'
import { Button } from '../components/ui/Button'
import { Badge, Card, Progress } from '../components/ui/Card'
import { MoneyInput } from '../components/ui/Fields'
import { Empty } from '../components/ui/Feedback'
import { addToSaved, setGoalCompleted } from '../db/notesGoals'
import { GOAL_TYPES, goalProgress } from '../lib/calc/goals'
import { daysBetween, fmtDate } from '../lib/dates'
import { daysWord, fmtMoney, fmtPercent, parseMoney } from '../lib/money'
import { useApp } from '../store/context'
import { errText, useUI } from '../store/ui'
import type { Goal } from '../types'

export function GoalsPage() {
  const { goals, entries, txs, loans } = useApp()
  const open = useUI((s) => s.open)
  const sorted = useMemo(() => [...goals].sort((a, b) => Number(a.completed) - Number(b.completed) || b.createdAt - a.createdAt), [goals])
  return (
    <>
      <PageHeader title="Цели" sub="Прогресс считается из реальных данных" action={<Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => open({ kind: 'goal' })}>Новая</Button>} />
      {goals.length === 0 ? (
        <Card><Empty icon={<Target />} title="Целей пока нет" text="Поставьте цель: заработать сумму за месяц, накопить на подушку, не выйти за лимит расходов или собрать резерв на кредитные платежи." action={<Button variant="primary" onClick={() => open({ kind: 'goal' })}>Создать цель</Button>} /></Card>
      ) : <div className="grid gap-4 lg:grid-cols-2">{sorted.map((g) => <GoalCard key={g.id} g={g} entries={entries} txs={txs} loans={loans} />)}</div>}
    </>
  )
}

function GoalCard({ g, entries, txs, loans }: { g: Goal; entries: ReturnType<typeof useApp>['entries']; txs: ReturnType<typeof useApp>['txs']; loans: ReturnType<typeof useApp>['loans'] }) {
  const { today } = useApp()
  const open = useUI((s) => s.open)
  const toast = useUI((s) => s.toast)
  const p = goalProgress(g, entries, txs, loans)
  const meta = GOAL_TYPES[g.type]
  const [amt, setAmt] = useState('')
  const left = g.periodEnd ? daysBetween(today, g.periodEnd) : null
  const color = g.completed ? '#34d399' : p.over ? '#fb5a6b' : undefined

  const adjust = async (sign: 1 | -1) => {
    const v = parseMoney(amt)
    if (v === null || v <= 0) { toast('Введите сумму больше нуля', 'bad'); return }
    try { await addToSaved(g.id!, sign * v); setAmt(''); toast(sign > 0 ? 'Накопления пополнены' : 'Сумма снята') } catch (e) { toast(errText(e), 'bad') }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="break-words text-[17px] font-bold leading-snug">{g.title}</h3><div className="mt-1 flex flex-wrap gap-2"><Badge color="#a78bfa">{meta.label}</Badge>{g.completed && <Badge color="#34d399">Завершена</Badge>}{!g.completed && p.done && g.type !== 'limit' && <Badge color="#34d399">Цель достигнута</Badge>}{p.over && <Badge color="#fb5a6b">Лимит превышен</Badge>}</div></div>
        <button onClick={() => open({ kind: 'goal', id: g.id })} className="rounded-xl p-2 text-muted hover:bg-white/8 hover:text-ink" aria-label="Изменить"><Pencil className="size-4" /></button>
      </div>
      <div>
        <div className="mb-2 flex items-end justify-between"><span className="text-2xl font-extrabold tabular-nums">{fmtMoney(p.current)}</span><span className="text-sm text-muted">из {fmtMoney(p.target)}</span></div>
        <Progress value={p.percent} color={color} over={p.over} height={10} />
        <div className="mt-2 flex justify-between text-xs text-muted"><span>{fmtPercent(Math.round(p.percent))}</span><span>{g.type === 'limit' ? (p.over ? `превышение ${fmtMoney(p.current - p.target)}` : `осталось ${fmtMoney(p.left)}`) : p.left > 0 ? `осталось ${fmtMoney(p.left)}` : 'готово'}</span></div>
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
        <Stat label="Срок" value={g.periodEnd ? `до ${fmtDate(g.periodEnd, 'd MMM')}` : 'без срока'} />
        <Stat label="Осталось времени" value={left === null ? '—' : left < 0 ? 'срок вышел' : daysWord(left)} tone={left !== null && left < 0 && !p.done ? 'bad' : undefined} />
      </div>
      <p className="text-xs leading-relaxed text-faint">{meta.definition}</p>
      {g.type === 'save' && !g.completed && (
        <div className="flex items-end gap-2"><div className="flex-1"><MoneyInput value={amt} onChange={setAmt} placeholder="Сумма" /></div><Button variant="primary" onClick={() => adjust(1)}>Внести</Button><Button onClick={() => adjust(-1)}>Снять</Button></div>
      )}
      <Button full icon={g.completed ? <RotateCcw className="size-4" /> : <Check className="size-4" />} onClick={() => setGoalCompleted(g.id!, !g.completed).then(() => toast(g.completed ? 'Цель снова активна' : 'Цель отмечена завершённой'))}>{g.completed ? 'Вернуть в работу' : 'Отметить завершённой'}</Button>
    </Card>
  )
}
