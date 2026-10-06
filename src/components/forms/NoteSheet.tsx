import { Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { deleteNote, saveNote } from '../../db/notesGoals'
import { SHIFT_STATUS } from '../../lib/constants'
import { fmtDate, fmtShort, todayStr } from '../../lib/dates'
import { fmtMoney } from '../../lib/money'
import { useApp } from '../../store/context'
import { errText, useUI } from '../../store/ui'
import type { NoteLink } from '../../types'
import { Button } from '../ui/Button'
import { Field, Input, Select, Textarea } from '../ui/Fields'
import { Modal } from '../ui/Modal'

type LinkType = 'none' | NoteLink['type']

export function NoteSheet({ id, link }: { id?: number; link?: NoteLink }) {
  const { notes, shifts, txs, loans } = useApp()
  const close = useUI((s) => s.close)
  const toast = useUI((s) => s.toast)
  const ask = useUI((s) => s.ask)
  const ex = id ? notes.find((n) => n.id === id) : undefined
  const initial = ex?.link ?? link
  const [title, setTitle] = useState(ex?.title ?? '')
  const [text, setText] = useState(ex?.text ?? '')
  const [pinned, setPinned] = useState(ex?.pinned ?? false)
  const [ltype, setLtype] = useState<LinkType>(initial?.type ?? 'none')
  const [day, setDay] = useState(initial?.type === 'day' ? initial.date : todayStr())
  const [refId, setRefId] = useState<string>(initial && 'refId' in initial ? String(initial.refId) : '')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const recentShifts = useMemo(() => [...shifts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 80), [shifts])
  const recentTx = useMemo(() => [...txs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100), [txs])

  const submit = async () => {
    if (!title.trim() && !text.trim()) { setErr('Введите заголовок или текст'); return }
    let l: NoteLink | undefined
    if (ltype === 'day') { if (!day) { setErr('Выберите день'); return } l = { type: 'day', date: day } }
    if (ltype === 'shift') { const s = shifts.find((x) => x.id === Number(refId)); if (!s) { setErr('Выберите смену'); return } l = { type: 'shift', refId: s.id!, date: s.date } }
    if (ltype === 'transaction') { if (!refId) { setErr('Выберите запись'); return } l = { type: 'transaction', refId: Number(refId) } }
    if (ltype === 'loan') { if (!refId) { setErr('Выберите кредит'); return } l = { type: 'loan', refId: Number(refId) } }
    setSaving(true)
    try {
      await saveNote({ id: ex?.id, title: title.trim() || text.trim().slice(0, 40), text: text.trim(), pinned, link: l })
      toast(ex ? 'Заметка сохранена' : 'Заметка добавлена')
      close()
    } catch (e) { toast(errText(e), 'bad') } finally { setSaving(false) }
  }

  const remove = () => ask({ title: 'Удалить заметку?', text: `«${ex!.title}» будет удалена без возможности восстановления.`, onConfirm: async () => { await deleteNote(ex!.id!); toast('Заметка удалена'); close() } })

  return (
    <Modal title={ex ? 'Заметка' : 'Новая заметка'} onClose={close}
      footer={<div className="flex gap-3">{ex && <Button variant="danger" aria-label="Удалить" onClick={remove} icon={<Trash2 className="size-4" />} />}<Button variant="primary" full loading={saving} onClick={submit}>Сохранить</Button></div>}>
      <div className="space-y-5">
        <Field label="Заголовок"><Input value={title} onChange={(e) => { setTitle(e.target.value); setErr('') }} placeholder="Коротко о главном" maxLength={80} /></Field>
        <Field label="Текст"><Textarea value={text} onChange={(e) => { setText(e.target.value); setErr('') }} className="min-h-40" placeholder="Что важно запомнить?" maxLength={5000} /></Field>
        <Field label="Связать с…">
          <Select value={ltype} onChange={(e) => { setLtype(e.target.value as LinkType); setRefId(''); setErr('') }}>
            <option value="none">Ни с чем</option><option value="day">Днём календаря</option><option value="shift">Сменой</option><option value="transaction">Доходом или расходом</option><option value="loan">Кредитом</option>
          </Select>
        </Field>
        {ltype === 'day' && <Field label="День"><Input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></Field>}
        {ltype === 'shift' && <Field label="Смена"><Select value={refId} onChange={(e) => setRefId(e.target.value)}><option value="">Выберите…</option>{recentShifts.map((s) => <option key={s.id} value={s.id}>{fmtDate(s.date, 'd MMM yyyy')} — {SHIFT_STATUS[s.status].short}</option>)}</Select></Field>}
        {ltype === 'transaction' && <Field label="Запись"><Select value={refId} onChange={(e) => setRefId(e.target.value)}><option value="">Выберите…</option>{recentTx.map((t) => <option key={t.id} value={t.id}>{fmtShort(t.date)} · {t.title} · {t.type === 'income' ? '+' : '−'}{fmtMoney(t.amount)}</option>)}</Select></Field>}
        {ltype === 'loan' && <Field label="Кредит"><Select value={refId} onChange={(e) => setRefId(e.target.value)}><option value="">Выберите…</option>{loans.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>}
        <label className="flex items-center gap-3 text-[15px]"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="size-5 accent-pink-500" />Закрепить вверху</label>
        {err && <p className="text-sm text-bad">{err}</p>}
        {ex && <p className="text-xs text-faint">Создана {new Date(ex.createdAt).toLocaleString('ru-RU')} · изменена {new Date(ex.updatedAt).toLocaleString('ru-RU')}</p>}
      </div>
    </Modal>
  )
}
