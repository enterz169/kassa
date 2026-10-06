import { useMemo, useState } from 'react'
import { PERIOD_LABELS, resolvePeriod, todayStr, type PeriodKey, type Range } from '../lib/dates'
import { Chips, Field, Input } from './ui/Fields'

export interface PeriodState { key: PeriodKey; custom: Range }

export function usePeriod(initial: PeriodKey = 'month') {
  const [state, setState] = useState<PeriodState>({ key: initial, custom: { from: todayStr(), to: todayStr() } })
  const range = useMemo(() => resolvePeriod(state.key, state.custom), [state])
  return { state, setState, range }
}

export function PeriodPicker({ state, onChange, keys }: { state: PeriodState; onChange: (s: PeriodState) => void; keys?: PeriodKey[] }) {
  const list = keys ?? (['today', 'yesterday', 'week', 'month', 'quarter', 'year', 'custom'] as PeriodKey[])
  const invalid = state.custom.from > state.custom.to
  return (
    <div className="space-y-3">
      <Chips value={state.key} onChange={(key) => onChange({ ...state, key })} options={list.map((k) => ({ value: k, label: PERIOD_LABELS[k] }))} />
      {state.key === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="С"><Input type="date" value={state.custom.from} onChange={(e) => onChange({ ...state, custom: { ...state.custom, from: e.target.value } })} invalid={invalid} /></Field>
          <Field label="По" error={invalid ? 'Конец раньше начала' : undefined}><Input type="date" value={state.custom.to} onChange={(e) => onChange({ ...state, custom: { ...state.custom, to: e.target.value } })} invalid={invalid} /></Field>
        </div>
      )}
    </div>
  )
}
