import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { getMaternityEI } from '../api/tax'
import { calculateTax } from '../api/tax'
import { fmt } from '../api/client'
import ReactMarkdown from 'react-markdown'
import { askClaude } from '../api/ai'

export default function MaternityPlanning() {
  const [leave1Year, setLeave1Year] = useState(2027)
  const [leave2Year, setLeave2Year] = useState(2028)
  const [saudyaBase, setSaudyaBase] = useState(106000)
  const [weeksStandard, setWeeksStandard] = useState(35)
  const [eiData1, setEiData1] = useState<any>(null)
  const [eiData2, setEiData2] = useState<any>(null)
  const [taxNormal, setTaxNormal] = useState<any>(null)
  const [taxMat, setTaxMat] = useState<any>(null)
  const [aiAdvice, setAiAdvice] = useState<string | null>(null)
  const [loadingAI, setLoadingAI] = useState(false)

  const runCalc = async () => {
    const ei1 = await getMaternityEI(leave1Year, saudyaBase, weeksStandard)
    const ei2 = await getMaternityEI(leave2Year, saudyaBase, weeksStandard)
    setEiData1(ei1)
    setEiData2(ei2)

    const normal = await calculateTax({ year: leave1Year, employment_income: saudyaBase, bonus: 15000, province: 'ON' })
    const mat = await calculateTax({
      year: leave1Year,
      employment_income: saudyaBase * 0.25,
      bonus: 0,
      province: 'ON',
      is_maternity_leave: true,
      maternity_ei_income: ei1.annual_ei_benefit,
    })
    setTaxNormal(normal)
    setTaxMat(mat)
  }

  const getAdvice = async () => {
    setLoadingAI(true)
    try {
      const text = await askClaude(
        `Saudya is going on maternity leave in early ${leave1Year} and again around Sep ${leave2Year}. Her regular income is $${saudyaBase.toLocaleString()} base plus $15,000 bonus. EI standard benefit = 55% of insurable earnings. Please advise on: (1) optimal RRSP contribution strategy during maternity years, (2) TFSA contributions — should she continue?, (3) income splitting opportunities with Sean (who earns ~$325K), (4) impact on FHSA contributions, (5) strategies to minimize combined household tax during these low-income years, (6) EI clawback rules if Saudya earns side income.`,
        true, leave1Year
      )
      setAiAdvice(text)
    } finally {
      setLoadingAI(false)
    }
  }

  const taxSaving = taxNormal && taxMat ? taxNormal.total_tax - taxMat.total_tax : 0

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Maternity Leave Planning</h1>
      <p className="text-slate-400 text-sm mb-6">Model the financial impact of Saudya's maternity leaves on income, tax, and investments</p>

      <div className="card mb-6">
        <h2 className="font-semibold text-slate-200 mb-4">Settings</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="label">Leave 1 Year</label>
            <select className="input" value={leave1Year} onChange={e => setLeave1Year(Number(e.target.value))}>
              {[2026, 2027, 2028, 2029].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Leave 2 Year</label>
            <select className="input" value={leave2Year} onChange={e => setLeave2Year(Number(e.target.value))}>
              {[2027, 2028, 2029, 2030].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Saudya Base Salary</label>
            <input type="number" className="input" value={saudyaBase} onChange={e => setSaudyaBase(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">EI Weeks (standard=35)</label>
            <input type="number" className="input" value={weeksStandard} onChange={e => setWeeksStandard(Number(e.target.value))} />
          </div>
        </div>
        <button onClick={runCalc} className="btn-primary">Calculate Impact</button>
      </div>

      {eiData1 && (
        <>
          {/* EI Benefits */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {[{ year: leave1Year, data: eiData1, label: 'Leave 1' }, { year: leave2Year, data: eiData2, label: 'Leave 2' }].map(({ year, data, label }) => (
              <div key={year} className="card">
                <h3 className="font-semibold text-slate-200 mb-3">{label} — {year}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Annual EI Benefit</span><span className="text-blue-300 font-semibold">{fmt(data?.annual_ei_benefit ?? 0)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Weekly Benefit</span><span className="text-slate-200">{fmt(data?.weekly_benefit ?? 0)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Weeks</span><span className="text-slate-200">{data?.weeks}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Rate</span><span className="text-slate-200">{data?.benefit_rate_pct}%</span></div>
                  <div className="text-xs text-amber-300/70 mt-2 border-t border-slate-700 pt-2">
                    ℹ {data?.note}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tax comparison */}
          {taxNormal && taxMat && (
            <div className="card mb-6">
              <h2 className="font-semibold text-slate-200 mb-4">Tax Impact — {leave1Year} (Saudya)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="px-4 py-2 text-left text-slate-500">Metric</th>
                      <th className="px-4 py-2 text-right text-slate-500">Full Year Income</th>
                      <th className="px-4 py-2 text-right text-slate-500">Maternity Leave Year</th>
                      <th className="px-4 py-2 text-right text-slate-500">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Gross Income', taxNormal.gross_income, taxMat.gross_income],
                      ['Total Tax', taxNormal.total_tax, taxMat.total_tax],
                      ['After-Tax Income', taxNormal.after_tax_income, taxMat.after_tax_income],
                      ['Marginal Rate', taxNormal.combined_marginal_pct, taxMat.combined_marginal_pct],
                    ].map(([label, normal, mat]) => {
                      const diff = (mat as number) - (normal as number)
                      const isRate = label === 'Marginal Rate'
                      return (
                        <tr key={label as string} className="border-b border-slate-800">
                          <td className="px-4 py-2 text-slate-300">{label as string}</td>
                          <td className="px-4 py-2 text-right text-slate-200">{isRate ? `${normal}%` : fmt(normal as number)}</td>
                          <td className="px-4 py-2 text-right text-blue-300">{isRate ? `${mat}%` : fmt(mat as number)}</td>
                          <td className={`px-4 py-2 text-right font-medium ${diff < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isRate ? `${diff > 0 ? '+' : ''}${diff}%` : `${diff > 0 ? '+' : ''}${fmt(diff)}`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {taxSaving > 0 && (
                <div className="mt-3 bg-emerald-900/20 border border-emerald-700/40 rounded-lg p-3 text-sm text-emerald-300">
                  💡 Lower income in {leave1Year} means a lower marginal rate — excellent time for Saudya to realize capital gains or income that would normally be taxed higher.
                </div>
              )}
            </div>
          )}

          {/* Opportunities */}
          <div className="card mb-6">
            <h2 className="font-semibold text-slate-200 mb-3">📋 Maternity Leave Opportunities</h2>
            <div className="space-y-3 text-sm">
              {[
                { title: 'Spousal RRSP contributions', desc: `Sean earns ~$325K and is in the top marginal bracket (~53%). Contributing to Saudya's spousal RRSP allows Sean to deduct at 53% while the money grows in Saudya's name. She'll withdraw at a much lower rate during retirement.`, flag: 'high' },
                { title: 'TFSA contributions', desc: `Both should still maximize TFSA annually ($7,000 each). TFSA room is not income-dependent — it grows every year regardless of earnings.`, flag: 'yes' },
                { title: 'Realize capital gains in Saudya\'s accounts', desc: `Saudya's lower income in ${leave1Year}/${leave2Year} means a lower marginal rate on capital gains. Consider triggering gains in her non-registered accounts during these years to pay less tax on them.`, flag: 'consider' },
                { title: 'FHSA contributions', desc: `FHSA room ($8,000 each) is available whether or not on maternity leave. Continue contributing if the remaining room exists. The 2026 contribution ($8K each) should be done before year-end.`, flag: 'yes' },
                { title: 'EI clawback risk', desc: `EI benefits are clawed back at 30% if net income exceeds $76,875 (2026). On mat leave Saudya's income will be well below this — no clawback concern.`, flag: 'info' },
              ].map(({ title, desc, flag }) => (
                <div key={title} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/40">
                  <span className="text-lg shrink-0">{flag === 'high' ? '⭐' : flag === 'yes' ? '✅' : flag === 'consider' ? '💡' : 'ℹ️'}</span>
                  <div>
                    <div className="font-medium text-slate-200">{title}</div>
                    <div className="text-slate-400 mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* AI Advice */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-100">🤖 AI Personalized Strategy</h2>
          <button onClick={getAdvice} disabled={loadingAI} className="btn-primary text-sm">
            {loadingAI ? 'Asking Claude…' : 'Get AI Strategy'}
          </button>
        </div>
        {aiAdvice ? (
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown>{aiAdvice}</ReactMarkdown>
          </div>
        ) : (
          <div className="text-slate-500 text-sm">Click to get a comprehensive maternity leave financial strategy from Claude</div>
        )}
      </div>
    </div>
  )
}
