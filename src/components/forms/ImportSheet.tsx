import clsx from 'clsx'
import { FileUp, ShieldCheck } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { importTransactions } from '../../db/transactions'
import { detectMapping, buildCandidates, ROLE_LABELS, type Candidate, type ColRole, type Mapping, type RowKind } from '../../lib/import/statement'
import { readTable, type Table } from '../../lib/import/table'
import { fmtDate } from '../../lib/dates'
import { fmtMoney, plural } from '../../lib/money'
import { useApp } from '../../store/context'
import { errText, useUI } from '../../store/ui'
import { Button } from '../ui/Button'
import { Select } from '../ui/Fields'
import { Notice } from '../ui/Feedback'
import { Modal } from '../ui/Modal'

const STATE_NOTE: Record<RowKind, string> = {
  ok: '', dup: 'Уже загружено', maybe: 'Похоже на вашу запись', loan: 'Платёж по кредиту', income: 'Приход / перевод', failed: 'Не прошла',
}
const ROLES: ColRole[] = ['none', 'date', 'amount', 'debit', 'credit', 'desc', 'category', 'status', 'card']

export function ImportSheet() {
  const { cats, txs } = useApp()
  const close = useUI((s) => s.close)
  const toast = useUI((s) => s.toast)
  const file = useRef<HTMLInputElement>(null)
  const [table, setTable] = useState<Table | null>(null)
  const [name, setName] = useState('')
  const [mapping, setMapping] = useState<Mapping | null>(null)
  const [rows, setRows] = useState<Candidate[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'take' | 'skip'>('take')
  const [showMap, setShowMap] = useState(false)

  const expCats = useMemo(() => cats.filter((c) => c.kind === 'expense'), [cats])

  const rebuild = (t: Table, m: Mapping) => setRows(buildCandidates({ table: t, mapping: m, cats, existing: txs }))

  const pick = async (f: File | undefined) => {
    if (!f) return
    setBusy(true); setError('')
    try {
      const t = await readTable(f)
      const m = detectMapping(t)
      setTable(t); setName(f.name)
      if (!m) { setMapping({ header: 0, cols: {} }); setRows([]); setShowMap(true); setError('Не удалось найти колонки с датой и суммой — укажите их вручную ниже.'); return }
      setMapping(m); rebuild(t, m)
      const c = buildCandidates({ table: t, mapping: m, cats, existing: txs })
      if (!c.length) setError('В файле не нашлось операций. Проверьте, что это выписка по карте с датами и суммами.')
    } catch (e) { setError(errText(e)); setTable(null) } finally { setBusy(false); if (file.current) file.current.value = '' }
  }

  const setRole = (idx: number, role: ColRole) => {
    if (!mapping || !table) return
    const cols = { ...mapping.cols }
    if (role !== 'none') for (const k of Object.keys(cols)) if (cols[Number(k)] === role) delete cols[Number(k)]
    if (role === 'none') delete cols[idx]; else cols[idx] = role
    const m = { ...mapping, cols }
    setMapping(m)
    const hasDate = Object.values(cols).includes('date'); const hasMoney = Object.values(cols).includes('amount') || Object.values(cols).includes('debit')
    if (hasDate && hasMoney) { setError(''); rebuild(table, m) } else setRows([])
  }

  const patch = (key: string, p: Partial<Candidate>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...p } : x)))
  const shown = rows.filter((r) => (tab === 'take' ? r.state === 'ok' : r.state !== 'ok'))
  const chosen = rows.filter((r) => r.selected)
  const sum = chosen.reduce((s, r) => s + r.amount, 0)
  const counts = { take: rows.filter((r) => r.state === 'ok').length, skip: rows.filter((r) => r.state !== 'ok').length }
  const hasLoan = rows.some((r) => r.state === 'loan')

  const submit = async () => {
    setBusy(true)
    try {
      const res = await importTransactions(chosen.map((r) => ({ date: r.date, amount: r.amount, title: r.title, categoryId: r.categoryId, key: r.key, comment: r.bankCat ? `Банк: ${r.bankCat}` : undefined })))
      toast(`Добавлено расходов: ${res.added}${res.skipped ? `, пропущено дублей: ${res.skipped}` : ''}`)
      close()
    } catch (e) { toast(errText(e), 'bad') } finally { setBusy(false) }
  }

  const header = table && mapping ? table[mapping.header] : []

  return (
    <Modal title="Импорт выписки" subtitle={name || 'PDF, CSV или Excel из приложения банка'} onClose={close}
      footer={rows.length > 0 ? <Button variant="primary" full loading={busy} disabled={!chosen.length} onClick={submit}>{chosen.length ? `Добавить ${chosen.length} ${plural(chosen.length, ['расход', 'расхода', 'расходов'])} на ${fmtMoney(sum)}` : 'Отметьте операции'}</Button> : undefined}>
      <div className="space-y-4">
        {!table && (
          <>
            <button type="button" onClick={() => file.current?.click()} disabled={busy} className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong bg-surface-2 px-4 py-8 text-center transition hover:border-pink/50">
              <FileUp className="size-8 text-pink" />
              <span className="text-[15px] font-semibold">{busy ? 'Читаю файл…' : 'Выбрать файл выписки'}</span>
              <span className="text-xs text-muted">PDF, CSV или Excel</span>
            </button>
            <input ref={file} type="file" accept=".pdf,.csv,.xlsx,.txt,application/pdf,text/csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            <div className="space-y-1.5 text-sm text-muted">
              <p><b className="text-ink">Как получить выписку:</b> в приложении банка откройте счёт или карту → «Выписка» / «Справка об операциях» → период → сохраните файл на телефон (PDF, CSV или Excel подойдут).</p>
              <p className="flex gap-2 text-xs text-faint"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" />Файл читается прямо на вашем устройстве и никуда не отправляется. Номера карты и пароли приложению не нужны.</p>
            </div>
          </>
        )}

        {rows.length > 0 && name.toLowerCase().endsWith('.pdf') && <Notice tone="info">Из PDF данные читаются по тексту, поэтому названия и знаки сумм бывают неточными. Просмотрите список перед добавлением; CSV или Excel из банка читаются надёжнее.</Notice>}

        {error && <Notice tone={rows.length ? 'warn' : 'bad'}>{error}</Notice>}

        {table && mapping && (
          <div>
            <button type="button" onClick={() => setShowMap((v) => !v)} className="text-xs text-muted underline-offset-2 hover:underline">{showMap ? 'Скрыть колонки' : 'Колонки определены неверно?'}</button>
            {showMap && (
              <div className="mt-2 space-y-2 rounded-2xl border border-line bg-surface-2 p-3">
                {header.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-muted">{String(h ?? '') || `Колонка ${i + 1}`}</span>
                    <Select className="!h-9 w-52 !text-[13px]" value={mapping.cols[i] ?? 'none'} onChange={(e) => setRole(i, e.target.value as ColRole)}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="flex gap-2">
              {([['take', `Добавить · ${counts.take}`], ['skip', `Пропущено · ${counts.skip}`]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k} className={clsx('h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium', tab === k ? 'border-transparent bg-brand text-white' : 'border-line bg-surface-2 text-muted')}>{l}</button>
              ))}
              {tab === 'take' && <button type="button" className="ml-auto shrink-0 whitespace-nowrap text-xs text-muted" onClick={() => { const all = shown.every((r) => r.selected); setRows((rs) => rs.map((r) => (r.state === 'ok' ? { ...r, selected: !all } : r))) }}>{shown.every((r) => r.selected) ? 'Снять все' : 'Выбрать все'}</button>}
            </div>

            {tab === 'skip' && (
              <Notice tone="info">Приходы и переводы между своими счетами не считаются тратами, а доход по сменам уже ведётся в календаре — поэтому они пропущены, чтобы не задвоить.{hasLoan ? ' Платежи по кредитам отмечайте в разделе «Кредиты» — тогда расход создаётся один раз.' : ''} Платёж по кредиту или похожий на вашу запись расход можно добавить вручную галочкой.</Notice>
            )}

            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface-2">
              {shown.length === 0 && <li className="p-4 text-center text-sm text-muted">Здесь пусто</li>}
              {shown.map((r) => {
                const locked = r.state === 'dup' || r.state === 'failed' || r.kind === 'income'
                return (
                  <li key={r.key} className={clsx('flex items-start gap-3 p-3', locked && 'opacity-50')}>
                    <input type="checkbox" className="mt-1 size-5 shrink-0 accent-pink" checked={r.selected} disabled={locked} onChange={(e) => patch(r.key, { selected: e.target.checked })} aria-label={`Добавить: ${r.title}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[14px] font-medium">{r.title}</span>
                        <span className={clsx('shrink-0 text-[14px] font-semibold tabular-nums', r.kind === 'income' && 'text-ok')}>{r.kind === 'income' ? '+' : '−'}{fmtMoney(r.amount)}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-faint">{fmtDate(r.date, 'd MMM yyyy')}{r.state !== 'ok' && STATE_NOTE[r.state] ? ` · ${STATE_NOTE[r.state]}` : ''}</div>
                      {r.kind === 'expense' && !locked && (
                        <Select className="!mt-1.5 !h-9 !text-[13px]" value={r.categoryId} onChange={(e) => patch(r.key, { categoryId: Number(e.target.value) })} aria-label="Категория">
                          {expCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="text-xs text-faint">Повторная загрузка той же выписки ничего не задвоит. Названия, которые вы уже вносили вручную, запоминаются вместе с категорией.</p>
          </>
        )}
      </div>
    </Modal>
  )
}
