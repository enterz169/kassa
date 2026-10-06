import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { deleteGoal, saveGoal } from '../../db/notesGoals'
import { GOAL_TYPES } from '../../lib/calc/goals'
import { addMonthsStr, monthEnd, monthStart, todayStr } from '../../lib/dates'
import { parseMoney } from '../../lib/money'
import { useApp } from '../../store/context'
import { errText, useUI } from '../../store/ui'
import type { GoalType } from '../../types'
import { Button } from '../ui/Button'
import { Field, Input, MoneyInput, Select } from '../ui/Fields'
import { Notice } from '../ui/Feedback'
import { Modal } from '../ui/Modal'

export function GoalSheet({ id }: { id?: number }) {
  const { goals } = useApp()
  const close = useUI((s) => s.close)
  const toast = useUI((s) => s.toast)
  const ask = useUI((s) => s.ask)
  const ex = id ? goals.find((g) => g.id === id) : undefined
  const today = todayStr()
  const [type, setType] = useState<GoalType>(ex?.type ?? 'earn')
  const [title, setTitle] = useState(ex?.title ?? '')
  const [target, setTarget] = useState(ex ? String(ex.target).replace('.', ',') : '')
  const [from, setFrom] = useState(ex?.periodStart ?? monthStart(today))
  const [to, setTo] = useState(ex?.periodEnd ?? monthEnd(addMonthsStr(today, 0)))
  const [saved, setSaved] = useState(ex ? String(ex.saved).replace('.', ',') : '')
  const [err, setErr] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const meta = GOAL_TYPES[type]
  const periodOptional = !meta.needsPeriod && type !== 'reserve'

  const submit = async () => {
    const e: Record<string, string> = {}
    const t = parseMoney(target)
    const sv = saved.trim() === '' ? 0 : parseMoney(saved)
    if (!title.trim()) e.title = 'Назовите цель'
    if (t === null || t <= 0) e.target = 'Введите целевую сумму больше нуля'
    if (sv === null) e.saved = 'Неверная сумма'
    if (meta.needsPeriod && (!from || !to)) e.period = 'Укажите период'
    if (from && to && to < from) e.period = 'Конец раньше начала'
    setErr(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      await saveGoal({ id: ex?.id, title: title.trim(), type, target: t!, periodStart: meta.needsPeriod || (periodOptional && from && to) ? from : undefined, periodEnd: meta.needsPeriod || (periodOptional && from && to) ? to : undefined, saved: type === 'save' ? sv ?? 0 : 0, completed: ex?.completed ?? false, completedAt: ex?.completedAt })
      toast(ex ? 'Цель обновлена' : 'Цель создана'); close()
    } catch (er) { toast(errText(er), 'bad') } finally { setSaving(false) }
  }
  const remove = () => ask({ title: 'Удалить цель?', text: `«${ex!.title}» будет удалена.`, onConfirm: async () => { await deleteGoal(ex!.id!); toast('Цель удалена'); close() } })

  return (
    <Modal title={ex ? 'Цель' : 'Новая цель'} onClose={close}
      footer={<div className="flex gap-3">{ex && <Button variant="danger" aria-label="Удалить" onClick={remove} icon={<Trash2 className="size-4" />} />}<Button variant="primary" full loading={saving} onClick={submit}>Сохранить</Button></div>}>
      <div className="space-y-5">
        <Field label="Тип цели"><Select value={type} onChange={(e) => setType(e.target.value as GoalType)} disabled={!!ex}>{(Object.keys(GOAL_TYPES) as GoalType[]).map((k) => <option key={k} value={k}>{GOAL_TYPES[k].label}</option>)}</Select></Field>
        <Notice tone="info"><b>Что считается прогрессом.</b> {meta.definition}</Notice>
        <Field label="Название" error={err.title}><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, 200 000 ₽ за месяц" maxLength={60} invalid={!!err.title} /></Field>
        <Field label="Целевая сумма" error={err.target}><MoneyInput value={target} onChange={setTarget} invalid={!!err.target} /></Field>
        {type === 'save' && <Field label="Уже накоплено" error={err.saved}><MoneyInput value={saved} onChange={setSaved} invalid={!!err.saved} /></Field>}
        {type !== 'reserve' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={periodOptional ? 'Срок: с (необязательно)' : 'Период: с'}><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} invalid={!!err.period} /></Field>
              <Field label={periodOptional ? 'по' : 'по'} error={err.period}><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} invalid={!!err.period} /></Field>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
