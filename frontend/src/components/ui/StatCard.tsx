import clsx from 'clsx'
import { fmt } from '../../api/client'

interface Props {
  label: string
  value: number
  sub?: string
  positive?: boolean
  negative?: boolean
  isCurrency?: boolean
}

export default function StatCard({ label, value, sub, positive, negative, isCurrency = true }: Props) {
  const isPos = positive ?? value > 0
  const isNeg = negative ?? value < 0
  return (
    <div className="card">
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">{label}</div>
      <div className={clsx(
        'text-2xl font-semibold',
        isPos && !isNeg ? 'text-emerald-400' : isNeg ? 'text-red-400' : 'text-slate-100'
      )}>
        {isCurrency ? fmt(Math.abs(value)) : value.toLocaleString()}
        {isNeg && <span className="text-red-400 ml-1 text-sm">▼</span>}
        {isPos && !isNeg && value !== 0 && <span className="text-emerald-400 ml-1 text-sm">▲</span>}
      </div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}
