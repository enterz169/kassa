import { CATEGORY_FALLBACK } from './txUtil'
import { fmtMoney } from '../lib/money'
import { fmtShort } from '../lib/dates'
import { Avatar, Row } from './Common'
import type { Category, Transaction } from '../types'

export function TxRow({ tx, cat, onClick }: { tx: Transaction; cat?: Category; onClick?: () => void }) {
  const color = cat?.color ?? CATEGORY_FALLBACK
  const income = tx.type === 'income'
  return (
    <Row
      onClick={onClick}
      left={<Avatar color={color}>{(cat?.name ?? '?').slice(0, 1).toUpperCase()}</Avatar>}
      title={tx.title}
      sub={`${cat?.name ?? 'Без категории'} · ${fmtShort(tx.date)}${tx.method ? ` · ${tx.method}` : ''}`}
      right={<span className={income ? 'text-ok' : 'text-ink'}>{income ? '+' : '−'}{fmtMoney(tx.amount)}</span>}
    />
  )
}
