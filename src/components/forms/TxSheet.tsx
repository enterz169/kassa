import { Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { addCategory, deleteTransaction, saveTransaction } from '../../db/transactions'
import { CATEGORY_COLORS, PAYMENT_METHODS } from '../../lib/constants'
import { todayStr } from '../../lib/dates'
import { parseMoney } from '../../lib/money'
import { useApp } from '../../store/context'
import { errText, useUI } from '../../store/ui'
import type { TxType } from '../../types'
import { Button } from '../ui/Button'
import { Field, Input, MoneyInput, Segmented, Select, Textarea } from '../ui/Fields'
import { Notice } from '../ui/Feedback'
import { Modal } from '../ui/Modal'

const NEW = '__new__'

export function TxSheet({ type: initialType, id }: { type: TxType; id?: number }) {
  const { txs, cats } = useApp()
  const close = useUI((s) => s.close)
  const toast = useUI((s) => s.toast)
  const ask = useUI((s) => s.ask)
  const open = useUI((s) => s.open)
  const existing = useMemo(() => (id ? txs.find((t) => t.id === id) : undefined), [txs, id])
  const today = todayStr()

  const [type, setType] = useState<TxType>(existing?.type ?? initialType)
  const [amount, setAmount] = useState(existing ? String(existing.amount).replace('.', ',') : '')
  const [title, setTitle] = useState(existing?.title ?? '')
  const [categoryId, setCategoryId] = useState<string>(existing ? String(existing.categoryId) : '')
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)])
  const [date, setDate] = useState(existing?.date ?? today)
  const [method, setMethod] = useState(existing?.method ?? PAYMENT_METHODS[0])
  const [comment, setComment] = useState(existing?.comment ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const list = cats.filter((c) => c.kind === type && c.key !== 'shift' && c.key !== 'loans' || c.id === existing?.categoryId)
  const isExpense = type === 'expense'
  const locked = !!existing?.loanPaymentId

  const submit = async () => {
    const e: Record<string, string> = {}
    const a = parseMoney(amount)
    if (a === null || a <= 0) e.amount = 'Введите сумму больше нуля (например, 1250 или 99,90)'
    if (a !== null && a > 100_000_000) e.amount = 'Слишком большая сумма'
    if (!title.trim()) e.title = 'Введите название'
    if (!categoryId) e.category = 'Выберите категорию'
    if (categoryId === NEW && !newName.trim()) e.category = 'Введите название новой категории'
    if (!date) e.date = 'Укажите дату'
    else if (date > today) e.date = 'Дата не может быть в будущем — это учёт фактических операций'
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      let cid = Number(categoryId)
      if (categoryId === NEW) cid = await addCategory({ kind: type, name: newName, color: newColor })
      await saveTransaction({ id: existing?.id, type, amount: a!, title: title.trim(), categoryId: cid, date, method: isExpense ? method : undefined, comment: comment.trim() || undefined, note: note.trim() || undefined })
      toast(existing ? 'Изменения сохранены' : isExpense ? 'Расход добавлен' : 'Доход добавлен')
      close()
    } catch (err) { toast(errText(err), 'bad') } finally { setSaving(false) }
  }

  const remove = () => ask({
    title: 'Удалить запись?', text: `«${existing!.title}» будет удалена, статистика пересчитается.`,
    onConfirm: async () => { await deleteTransaction(existing!.id!); toast('Запись удалена'); close() },
  })

  return (
    <Modal
      title={existing ? 'Запись' : isExpense ? 'Новый расход' : 'Новый доход'}
      onClose={close}
      footer={locked ? undefined : (
        <div className="flex gap-3">
          {existing && <Button variant="danger" aria-label="Удалить" onClick={remove} icon={<Trash2 className="size-4" />} />}
          <Button variant="primary" full loading={saving} onClick={submit}>{existing ? 'Сохранить' : 'Добавить'}</Button>
        </div>
      )}
    >
      <div className="space-y-5">
        {locked && (
          <Notice tone="info">
            Этот расход создан отметкой платежа по кредиту. Чтобы изменить или отменить его, откройте платёж в разделе «Кредиты».
            {existing?.loanPaymentId && <div className="mt-2"><Button size="sm" onClick={() => open({ kind: 'payment', id: existing.loanPaymentId! })}>Открыть платёж</Button></div>}
          </Notice>
        )}
        {!existing && <Segmented value={type} onChange={(t) => { setType(t); setCategoryId('') }} options={[{ value: 'expense', label: 'Расход' }, { value: 'income', label: 'Доход' }]} />}
        <Field label="Сумма" error={errors.amount}><MoneyInput autoFocus={!existing} value={amount} onChange={setAmount} invalid={!!errors.amount} disabled={locked} /></Field>
        <Field label="Название" error={errors.title}><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isExpense ? 'Например, продукты' : 'Например, подработка'} maxLength={80} invalid={!!errors.title} disabled={locked} /></Field>
        <Field label="Категория" error={errors.category} hint={!isExpense ? 'Заработок за смены учитывается автоматически из календаря — вручную его добавлять не нужно.' : 'Платежи по кредитам попадают в расходы сами, когда вы отмечаете их оплаченными.'}>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} invalid={!!errors.category} disabled={locked}>
            <option value="">Выберите…</option>
            {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value={NEW}>+ Новая категория…</option>
          </Select>
        </Field>
        {categoryId === NEW && (
          <div className="space-y-3 rounded-2xl border border-line bg-surface-2 p-3">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Название категории" maxLength={30} />
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => <button key={c} type="button" aria-label={c} onClick={() => setNewColor(c)} className="size-8 rounded-full ring-offset-2 ring-offset-surface-2 transition" style={{ background: c, boxShadow: newColor === c ? `0 0 0 2px ${c}` : undefined, outline: newColor === c ? '2px solid #111114' : undefined }} />)}
            </div>
          </div>
        )}
        <div className={isExpense ? 'grid grid-cols-2 gap-3' : ''}>
          <Field label="Дата" error={errors.date}><Input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} invalid={!!errors.date} disabled={locked} /></Field>
          {isExpense && <Field label="Способ оплаты"><Select value={method} onChange={(e) => setMethod(e.target.value)} disabled={locked}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</Select></Field>}
        </div>
        <Field label="Комментарий"><Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Необязательно" maxLength={160} disabled={locked} /></Field>
        <Field label="Заметка"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Необязательно" maxLength={500} disabled={locked} /></Field>
        {existing && !locked && <Button size="sm" onClick={() => open({ kind: 'note', link: { type: 'transaction', refId: existing.id! } })}>Создать заметку к записи</Button>}
      </div>
    </Modal>
  )
}
