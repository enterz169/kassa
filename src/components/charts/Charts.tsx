import { Area, AreaChart, Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART } from '../../lib/constants'
import { fmtCompact, fmtMoney } from '../../lib/money'
import type { CategorySlice } from '../../lib/calc/finance'

interface TipEntry { name?: string; value?: number | string; color?: string; dataKey?: string }
interface TipProps { active?: boolean; payload?: TipEntry[]; label?: string | number; labelFormatter?: (l: string) => string; valueFormatter?: (v: number, name: string) => string }

export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line-strong bg-surface-2/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      {label !== undefined && <div className="mb-1 font-semibold text-ink">{labelFormatter ? labelFormatter(String(label)) : String(label)}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-muted">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="ml-auto pl-3 font-semibold text-ink tabular-nums">{valueFormatter ? valueFormatter(Number(p.value), p.name ?? '') : fmtMoney(Number(p.value))}</span>
        </div>
      ))}
    </div>
  )
}

const axis = { stroke: CHART.axis, fontSize: 11, tickLine: false, axisLine: false } as const

export interface FlowPoint { label: string; income: number; expense: number; key?: string }

export function FlowChart({ data, height = 220, onPointClick, tickEvery = 1, labelFormatter }: { data: FlowPoint[]; height?: number; onPointClick?: (p: FlowPoint) => void; tickEvery?: number; labelFormatter?: (l: string) => string }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} onClick={(s) => { const idx = Number(s?.activeTooltipIndex); if (onPointClick && Number.isFinite(idx) && data[idx]) onPointClick(data[idx]) }}>
          <defs>
            <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART.income} stopOpacity={0.4} /><stop offset="100%" stopColor={CHART.income} stopOpacity={0} /></linearGradient>
            <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART.expense} stopOpacity={0.35} /><stop offset="100%" stopColor={CHART.expense} stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="label" {...axis} interval={tickEvery - 1} minTickGap={12} />
          <YAxis {...axis} allowDecimals={false} tickFormatter={(v) => fmtCompact(Number(v))} width={48} />
          <Tooltip content={<ChartTooltip labelFormatter={labelFormatter} />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
          <Area type="monotone" dataKey="income" name="Доходы" stroke={CHART.income} strokeWidth={2.2} fill="url(#gInc)" />
          <Area type="monotone" dataKey="expense" name="Расходы" stroke={CHART.expense} strokeWidth={2.2} fill="url(#gExp)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SingleBars({ data, color, height = 200, name, format, onBarClick, line }: {
  data: { label: string; value: number; key?: string; line?: number }[]; color: string; height?: number; name: string
  format?: (v: number, n: string) => string; onBarClick?: (key?: string) => void; line?: { name: string; color: string }
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="label" {...axis} minTickGap={10} />
          <YAxis {...axis} allowDecimals={false} tickFormatter={(v) => fmtCompact(Number(v))} width={48} />
          <Tooltip content={<ChartTooltip valueFormatter={format} />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar dataKey="value" name={name} fill={color} radius={[6, 6, 0, 0]} maxBarSize={36} onClick={(d) => onBarClick?.((d as { key?: string }).key)} cursor={onBarClick ? 'pointer' : undefined} />
          {line && <Line type="monotone" dataKey="line" name={line.name} stroke={line.color} strokeWidth={2} dot={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CompareBars({ data, height = 220 }: { data: { label: string; income: number; expense: number; net?: number }[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} allowDecimals={false} tickFormatter={(v) => fmtCompact(Number(v))} width={48} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#9c9ca8' }} />
          <Bar dataKey="income" name="Доходы" fill={CHART.income} radius={[6, 6, 0, 0]} maxBarSize={24} />
          <Bar dataKey="expense" name="Расходы" fill={CHART.expense} radius={[6, 6, 0, 0]} maxBarSize={24} />
          <Line type="monotone" dataKey="net" name="Результат" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Donut({ slices, size = 190, onSliceClick, center }: { slices: CategorySlice[]; size?: number; onSliceClick?: (id: number) => void; center?: React.ReactNode }) {
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={slices} dataKey="amount" nameKey="name" innerRadius="66%" outerRadius="100%" paddingAngle={slices.length > 1 ? 2 : 0} stroke="none" onClick={(d) => onSliceClick?.((d as unknown as CategorySlice).categoryId)} cursor={onSliceClick ? 'pointer' : undefined}>
            {slices.map((s) => <Cell key={s.categoryId} fill={s.color} />)}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {center && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
    </div>
  )
}

export function DebtChart({ data, height = 200 }: { data: { label: string; debt: number }[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <defs><linearGradient id="gDebt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff3d7f" stopOpacity={0.4} /><stop offset="100%" stopColor="#ff3d7f" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="label" {...axis} minTickGap={10} />
          <YAxis {...axis} allowDecimals={false} tickFormatter={(v) => fmtCompact(Number(v))} width={48} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="debt" name="Остаток долга" stroke="#ff3d7f" strokeWidth={2.2} fill="url(#gDebt)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
