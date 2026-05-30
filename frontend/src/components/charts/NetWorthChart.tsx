import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { fmt } from '../../api/client'
import type { ForecastSnapshot, ScenarioKey } from '../../types'

interface Props {
  data: ForecastSnapshot[]
  scenario: ScenarioKey
}

const COLORS = {
  sean: '#3b82f6',
  saudya: '#a78bfa',
  joint: '#34d399',
}

const fmtM = (v: number) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}K`

export default function NetWorthChart({ data, scenario }: Props) {
  const chartData = data.map(d => ({
    year: d.year,
    Sean: Math.round(d.sean_net_worth[scenario]),
    Saudya: Math.round(d.saudya_net_worth[scenario]),
    Combined: Math.round(d.combined_net_worth[scenario]),
    hasEvent: d.events.length > 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <defs>
          {(['Sean', 'Saudya', 'Combined'] as const).map((key, i) => (
            <linearGradient key={key} id={`grad${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={Object.values(COLORS)[i]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={Object.values(COLORS)[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="year" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} />
        <YAxis tickFormatter={fmtM} stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} width={70} />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
          labelStyle={{ color: '#cbd5e1' }}
          formatter={(v: number) => [fmt(v), '']}
        />
        <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
        <Area type="monotone" dataKey="Combined" stroke={COLORS.joint} fill="url(#gradCombined)" strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="Sean" stroke={COLORS.sean} fill="url(#gradSean)" strokeWidth={1.5} dot={false} />
        <Area type="monotone" dataKey="Saudya" stroke={COLORS.saudya} fill="url(#gradSaudya)" strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
