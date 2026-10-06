import { useMemo } from 'react'
import { rangeLabel, inRange } from '../../lib/dates'
import { fmtMoney } from '../../lib/money'
import { useApp } from '../../store/context'
import { useUI } from '../../store/ui'
import type { TxType } from '../../types'
import { TxRow } from '../TxRow'
import { Empty } from '../ui/Feedback'
import { Modal } from '../ui/Modal'
import { Receipt } from 'lucide-react'

export function DrillSheet({ title, categoryId, from, to, txType = 'expense' }: { title: string; categoryId?: number; from: string; to: string; txType?: TxType }) {
  const { txs, catById } = useApp()
  const close = useUI((s) => s.close)
  const open = useUI((s) => s.open)
  const list = useMemo(
    () => txs.filter((t) => t.type === txType && (categoryId === undefined || t.categoryId === categoryId) && inRange(t.date, { from, to })).sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0)),
    [txs, categoryId, from, to, txType],
  )
  const total = list.reduce((a, t) => a + t.amount, 0)
  return (
    <Modal title={title} subtitle={`${rangeLabel({ from, to })} · ${fmtMoney(total)}`} onClose={close}>
      {list.length === 0 ? <Empty icon={<Receipt />} title="Записей нет" text="За выбранный период ничего не найдено." /> : (
        <div className="divide-y divide-line">{list.map((t) => <TxRow key={t.id} tx={t} cat={catById.get(t.categoryId)} onClick={() => open({ kind: 'tx', type: t.type, id: t.id })} />)}</div>
      )}
    </Modal>
  )
}
