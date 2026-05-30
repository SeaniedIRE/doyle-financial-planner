import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { calculateTax } from '../api/tax'
import { fmt } from '../api/client'
import type { TaxResult } from '../types'

const DEFAULTS = {
  sean: { employment_income: 245000, bonus: 65000, other_bonus: 15000, rrsp_deduction: 32490, margin_interest_deduction: 3950 },
  saudya: { employment_income: 106000, bonus: 15000, other_bonus: 0, rrsp_deduction: 21780, margin_interest_deduction: 3950 },
}

function TaxForm({ person, label, year }: { person: 'sean' | 'saudya'; label: string; year: number }) {
  const defaults = DEFAULTS[person]
  const [form, setForm] = useState({ ...defaults, capital_gains_realized: 0, eligible_dividends: 0, other_income: 0, province: 'ON', is_maternity_leave: false, maternity_ei_income: 0, year })
  const [result, setResult] = useState<TaxResult | null>(null)
  const mut = useMutation({ mutationFn: () => calculateTax(form), onSuccess: setResult })

  const n = (label: string, key: keyof typeof form, type: 'number' | 'checkbox' = 'number') => (
    <div>
      <label className="label">{label}</label>
      {type === 'checkbox'
        ? <input type="checkbox" checked={!!form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} className="w-4 h-4" />
        : <input type="number" className="input" value={form[key] as number}
            onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))} />
      }
    </div>
  )

  return (
    <div className="card">
      <h2 className="font-semibold text-slate-100 mb-4">{label}</h2>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {n('Employment Income', 'employment_income')}
        {n('Bonus', 'bonus')}
        {n('Other Bonus', 'other_bonus')}
        {n('Capital Gains Realized', 'capital_gains_realized')}
        {n('Eligible Dividends', 'eligible_dividends')}
        {n('RRSP Deduction', 'rrsp_deduction')}
        {n('Margin Interest Deduction', 'margin_interest_deduction')}
        {n('Other Income', 'other_income')}
        <div>
          <label className="label">Maternity Leave?</label>
          <input type="checkbox" checked={form.is_maternity_leave}
            onChange={e => setForm(f => ({ ...f, is_maternity_leave: e.target.checked }))}
            className="w-4 h-4 mt-1" />
        </div>
        {form.is_maternity_leave && n('EI Maternity Income', 'maternity_ei_income')}
      </div>
      <button onClick={() => mut.mutate()} disabled={mut.isPending} className="btn-primary w-full mb-4">
        {mut.isPending ? 'Calculating…' : 'Calculate Tax'}
      </button>

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Gross Income', result.gross_income],
              ['Taxable Income', result.taxable_income],
              ['Federal Tax', result.federal_tax],
              ['Ontario Tax', result.provincial_tax],
              ['Total Tax', result.total_tax],
              ['After-Tax Income', result.after_tax_income],
            ].map(([l, v]) => (
              <div key={l as string} className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">{l as string}</div>
                <div className={`font-semibold ${l === 'After-Tax Income' ? 'text-emerald-400' : l === 'Total Tax' ? 'text-red-400' : 'text-slate-100'}`}>
                  {fmt(v as number)}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-500 mb-1">Average Rate</div>
              <div className="text-amber-300 font-semibold">{result.average_rate_pct.toFixed(1)}%</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-500 mb-1">Marginal Rate</div>
              <div className="text-red-300 font-semibold">{result.combined_marginal_pct.toFixed(1)}%</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-500 mb-1">Capital Gains Tax</div>
              <div className="text-orange-300 font-semibold">{fmt(result.capital_gains_tax)}</div>
            </div>
          </div>
          {result.notes && (
            <div className="text-xs text-slate-500 space-y-0.5">
              {result.notes.map((n, i) => <div key={i}>ℹ {n}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TaxPlanning() {
  const [year, setYear] = useState(2026)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Tax Planning</h1>
          <p className="text-slate-400 text-sm mt-1">Federal + Ontario tax. CRA 2026 rules. 50% capital gains inclusion.</p>
        </div>
        <div>
          <label className="label">Tax Year</label>
          <select className="input w-28" value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <TaxForm person="sean" label="Sean" year={year} />
        <TaxForm person="saudya" label="Saudya" year={year} />
      </div>

      <div className="card">
        <h2 className="font-semibold text-slate-100 mb-4">📖 CRA Rules Reference</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="text-blue-300 font-medium mb-2">Capital Gains (ITA s.38)</h3>
            <ul className="text-slate-400 space-y-1">
              <li>• 50% of capital gains included in income (2026)</li>
              <li>• Capital losses offset capital gains in same year</li>
              <li>• Excess losses carry back 3 years or forward indefinitely</li>
              <li>• ACB tracking required per security per account</li>
              <li>• Superficial loss rule: no repurchase within 30 days (ITA s.54)</li>
            </ul>
          </div>
          <div>
            <h3 className="text-blue-300 font-medium mb-2">RRSP Deduction</h3>
            <ul className="text-slate-400 space-y-1">
              <li>• 18% of prior year earned income, up to annual limit</li>
              <li>• 2026 limit: $32,490</li>
              <li>• Unused room carries forward indefinitely</li>
              <li>• Spousal RRSP: contribute to partner's RRSP, claim your own deduction</li>
            </ul>
          </div>
          <div>
            <h3 className="text-blue-300 font-medium mb-2">Margin Interest Deduction (ITA s.20(1)(c))</h3>
            <ul className="text-slate-400 space-y-1">
              <li>• Interest on money borrowed to earn investment income is deductible</li>
              <li>• Must be used for income-producing investments (not TFSA/RRSP)</li>
              <li>• Keep records of loan purpose</li>
              <li>• Sean & Saudya: ~$3,950/yr each at 3.95% on $100K loan</li>
            </ul>
          </div>
          <div>
            <h3 className="text-blue-300 font-medium mb-2">FHSA (ITA s.146.6)</h3>
            <ul className="text-slate-400 space-y-1">
              <li>• $8,000/year, $40,000 lifetime contribution limit</li>
              <li>• Contributions are tax-deductible (like RRSP)</li>
              <li>• Withdrawals for qualifying home purchase are tax-free</li>
              <li>• Must be a first-time home buyer</li>
              <li>• Account must be open for one calendar year before withdrawal</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
