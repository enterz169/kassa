import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { addCategory, categoryUsage, deleteCategory, updateCategory } from '../../db/transactions'
import { CATEGORY_COLORS } from '../../lib/constants'
import { useApp } from '../../store/context'
import { errText, useUI } from '../../store/ui'
import type { TxType } from '../../types'
import { Button, IconButton } from '../ui/Button'
import { Dot } from '../ui/Card'
import { Input } from '../ui/Fields'
import { Modal } from '../ui/Modal'

export function CategoriesSheet({ type }: { type: TxType }) {
  const { cats, txs } = useApp()
  const close = useUI((s) => s.close)
  const toast = useUI((s) => s.toast)
  const ask = useUI((s) => s.ask)
  const [editing, setEditing] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(CATEGORY_COLORS[0])
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[4])

  const list = cats.filter((c) => c.kind === type)
  const usage = (id: number) => txs.filter((t) => t.categoryId === id).length

  const save = async (id: number) => {
    try { await updateCategory(id, { name, color }); setEditing(null); toast('Категория обновлена') } catch (e) { toast(errText(e), 'bad') }
  }
  const add = async () => {
    try { await addCategory({ kind: type, name: newName, color: newColor }); setNewName(''); toast('Категория добавлена') } catch (e) { toast(errText(e), 'bad') }
  }
  const remove = async (id: number, nm: string) => {
    const n = await categoryUsage(id)
    if (n > 0) { toast(`Категория «${nm}» используется в записях (${n}) — удалить нельзя`, 'bad'); return }
    ask({ title: `Удалить категорию «${nm}»?`, text: 'Она не используется ни в одной записи.', onConfirm: async () => { await deleteCategory(id); toast('Категория удалена') } })
  }

  return (
    <Modal title={type === 'expense' ? 'Категории расходов' : 'Источники дохода'} subtitle="Переименуйте, перекрасьте или добавьте свои" onClose={close}>
      <div className="space-y-1">
        {list.map((c) => (
          <div key={c.id} className="rounded-2xl border border-line bg-surface-2 p-3">
            {editing === c.id ? (
              <div className="space-y-3">
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoFocus />
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map((x) => <button key={x} type="button" aria-label={x} onClick={() => setColor(x)} className="size-8 rounded-full" style={{ background: x, boxShadow: color === x ? `0 0 0 2px #17171b, 0 0 0 4px ${x}` : undefined }} />)}
                </div>
                <div className="flex gap-2"><Button size="sm" variant="primary" icon={<Check className="size-4" />} onClick={() => save(c.id!)}>Сохранить</Button><Button size="sm" onClick={() => setEditing(null)}>Отмена</Button></div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Dot color={c.color} size={12} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">{c.name}</div>
                  <div className="text-xs text-faint">{c.system ? 'Системная · ' : ''}записей: {usage(c.id!)}</div>
                </div>
                <IconButton label="Переименовать" onClick={() => { setEditing(c.id!); setName(c.name); setColor(c.color) }}><Pencil className="size-4" /></IconButton>
                {!c.system && <IconButton label="Удалить" onClick={() => remove(c.id!, c.name)}><Trash2 className="size-4" /></IconButton>}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-3 rounded-2xl border border-dashed border-line-strong p-3">
        <div className="text-[13px] font-medium text-muted">Новая категория</div>
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Название" maxLength={30} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((x) => <button key={x} type="button" aria-label={x} onClick={() => setNewColor(x)} className="size-8 rounded-full" style={{ background: x, boxShadow: newColor === x ? `0 0 0 2px #111114, 0 0 0 4px ${x}` : undefined }} />)}
        </div>
        <Button variant="primary" full icon={<Plus className="size-4" />} onClick={add} disabled={!newName.trim()}>Добавить</Button>
      </div>
    </Modal>
  )
}
