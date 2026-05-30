import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getScenarios, runForecast } from '../api/scenarios'
import { fmt } from '../api/client'
import NetWorthChart from '../components/charts/NetWorthChart'
import type { ForecastSnapshot, ScenarioKey, Scenario } from '../types'
import { TrendingUp, Calendar, AlertCircle } from 'lucide-react'

const SCENARIO_COLORS: Record<ScenarioKey, string> = {
  conservative: 'text-amber-400',
  moderate: 'text-blue-400',
  optimistic: 'text-emerald-400',
}

export default function Forecasts() {
  const { data: scenarios = [] } = useQuery({ queryKey: ['scenarios'], queryFn: getScenarios })
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null)
  const [viewScenario, setViewScenario] = useState<ScenarioKey>('moderate')
  const [params, setParams] = useState({
    end_year: 2040,
    mat_leave_1_year: 2027,
    mat_leave_2_year: 2028,
    sean_margin_loan: 100000,
    saudya_margin_loan: 100000,
    margin_rate: 3.95,
    salary_growth_rate: 4,
  })
  const [forecastData, setForecastData] = useState<ForecastSnapshot[] | null>(null)

  const runMut = useMutation({
    mutationFn: (id: number) => runForecast(id, {
      ...params,
      salary_growth_rate: params.salary_growth_rate / 100,
    }),
    onSuccess: setForecastData,
  })

  const baseline = scenarios.find(s => s.is_baseline) ?? scenarios[0]

  const handleRun = () => {
    const id = selectedScenario ?? baseline?.id
    if (id) runMut.mutate(id)
  }

  const activeScenario = scenarios.find(s => s.id === (selectedScenario ?? baseline?.id))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Portfolio Forecasts</h1>
      <p className="text-slate-400 text-sm mb-6">
        Multi-year compounding projections with three growth scenarios. Accounts for TFSA/RRSP/FHSA contributions, maternity leave, and house purchase.
      </p>

      {/* Controls */}
      <div className="card mb-6">
        <h2 className="font-semibold text-slate-200 mb-4">Forecast Settings</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="label">Scenario</label>
            <select className="input" value={selectedScenario ?? ''} onChange={e => setSelectedScenario(e.target.value ? Number(e.target.value) : null)}>
              {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">End Year</label>
            <select className="input" value={params.end_year} onChange={e => setParams(p => ({ ...p, end_year: Number(e.target.value) }))}>
              {[2030, 2035, 2040, 2045, 2050].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Salary Growth %/yr</label>
            <input type="number" className="input" value={params.salary_growth_rate} onChange={e => setParams(p => ({ ...p, salary_growth_rate: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Margin Rate %</label>
            <input type="number" className="input" step="0.25" value={params.margin_rate} onChange={e => setParams(p => ({ ...p, margin_rate: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Mat Leave 1 Year</label>
            <input type="number" className="input" value={params.mat_leave_1_year} onChange={e => setParams(p => ({ ...p, mat_leave_1_year: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Mat Leave 2 Year</label>
            <input type="number" className="input" value={params.mat_leave_2_year} onChange={e => setParams(p => ({ ...p, mat_leave_2_year: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Sean Margin Loan</label>
            <input type="number" className="input" value={params.sean_margin_loan} onChange={e => setParams(p => ({ ...p, sean_margin_loan: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Saudya Margin Loan</label>
            <input type="number" className="input" value={params.saudya_margin_loan} onChange={e => setParams(p => ({ ...p, saudya_margin_loan: Number(e.target.value) }))} />
          </div>
        </div>

        {activeScenario && (
          <div className="mb-4 text-sm text-slate-400 bg-slate-800/50 rounded-lg p-3">
            <strong className="text-slate-300">{activeScenario.name}</strong> — Growth rates:{' '}
            <span className="text-amber-400">Conservative {activeScenario.growth_conservative_pct}%</span>,{' '}
            <span className="text-blue-400">Moderate {activeScenario.growth_moderate_pct}%</span>,{' '}
            <span className="text-emerald-400">Optimistic {activeScenario.growth_optimistic_pct}%</span>. House {activeScenario.house_purchase_year}.
          </div>
        )}

        <button onClick={handleRun} disabled={runMut.isPending} className="btn-primary flex items-center gap-2">
          <TrendingUp size={16} />
          {runMut.isPending ? 'Running…' : 'Run Forecast'}
        </button>
      </div>

      {forecastData && (
        <>
          {/* Growth scenario toggle */}
          <div className="flex gap-2 mb-4">
            {(['conservative', 'moderate', 'optimistic'] as ScenarioKey[]).map(s => (
              <button key={s} onClick={() => setViewScenario(s)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${viewScenario === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                {s === 'conservative' ? '🐢 Conservative' : s === 'moderate' ? '⚖️ Moderate' : '🚀 Optimistic'}
                <span className={`ml-2 text-xs ${SCENARIO_COLORS[s]}`}>
                  {s === 'conservative' ? `${activeScenario?.growth_conservative_pct}%` : s === 'moderate' ? `${activeScenario?.growth_moderate_pct}%` : `${activeScenario?.growth_optimistic_pct}%`}
                </span>
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="card mb-6">
            <h2 className="font-semibold text-slate-200 mb-4">Combined Net Worth Projection</h2>
            <NetWorthChart data={forecastData} scenario={viewScenario} />
          </div>

          {/* Events timeline */}
          {forecastData.some(d => d.events.length > 0) && (
            <div className="card mb-6">
              <h2 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <Calendar size={16} /> Key Life Events
              </h2>
              <div className="space-y-2">
                {forecastData.filter(d => d.events.length > 0).map(d => (
                  <div key={d.year} className="flex items-start gap-3 text-sm">
                    <span className="text-blue-400 font-medium w-12 shrink-0">{d.year}</span>
                    <div className="text-slate-300">{d.events.join(', ')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Year-by-year table */}
          <div className="card overflow-x-auto">
            <h2 className="font-semibold text-slate-200 mb-4">Year-by-Year Detail ({viewScenario})</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Year', 'Combined Net Worth', 'Sean NW', 'Saudya NW', 'Sean After-Tax', 'Saudya After-Tax', 'Tax Sean', 'Tax Saudya', 'Events'].map(h => (
                    <th key={h} className="px-3 py-2 text-right first:text-left text-xs text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {forecastData.map(d => (
                  <tr key={d.year} className={`border-b border-slate-800 hover:bg-slate-800/30 ${d.events.length > 0 ? 'bg-blue-900/10' : ''}`}>
                    <td className="px-3 py-2 font-medium text-slate-200">{d.year}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-100">{fmt(d.combined_net_worth[viewScenario])}</td>
                    <td className="px-3 py-2 text-right text-blue-300">{fmt(d.sean_net_worth[viewScenario])}</td>
                    <td className="px-3 py-2 text-right text-purple-300">{fmt(d.saudya_net_worth[viewScenario])}</td>
                    <td className="px-3 py-2 text-right text-emerald-400">{fmt(d.sean_income_after_tax)}</td>
                    <td className="px-3 py-2 text-right text-emerald-400">{fmt(d.saudya_income_after_tax)}</td>
                    <td className="px-3 py-2 text-right text-red-400">{fmt(d.sean_tax)}</td>
                    <td className="px-3 py-2 text-right text-red-400">{fmt(d.saudya_tax)}</td>
                    <td className="px-3 py-2 text-xs text-blue-300">{d.events.join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
