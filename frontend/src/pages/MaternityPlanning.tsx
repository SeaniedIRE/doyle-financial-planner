import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { getMaternityEI } from '../api/tax'
import { calculateTax } from '../api/tax'
import { fmt } from '../api/client'
import ReactMarkdown from 'react-markdown'
import { askClaude } from '../api/ai'

// ── Employer top-up helpers ──────────────────────────────────────────────────

/** Weekly employer top-up above EI. Returns 0 if EI already covers the target. */
function calcWeeklyTopup(salaryAnnual: number, topupPct: number, eiWeekly: number): number {
  const targetWeekly = (salaryAnnual / 52) * (topupPct / 100)
  return Math.max(0, targetWeekly - eiWeekly)
}

/** Total employer top-up income for the leave period. */
function calcTotalTopup(salaryAnnual: number, topupPct: number, topupWeeks: number, eiWeekly: number): number {
  return calcWeeklyTopup(salaryAnnual, topupPct, eiWeekly) * topupWeeks
}

export default function MaternityPlanning() {
  const [leave1Year, setLeave1Year] = useState(2027)
  const [leave2Year, setLeave2Year] = useState(2028)
  const [saudyaBase, setSaudyaBase] = useState(106000)
  const [weeksStandard, setWeeksStandard] = useState(35)
  // Employer top-up fields
  const [topupWeeks, setTopupWeeks] = useState(0)
  const [topupPct, setTopupPct] = useState(100)
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

    // Employer top-up is taxable employment income
    const topup1 = calcTotalTopup(saudyaBase, topupPct, topupWeeks, ei1.weekly_benefit)

    const normal = await calculateTax({ year: leave1Year, employment_income: saudyaBase, bonus: 15000, province: 'ON' })
    const mat = await calculateTax({
      year: leave1Year,
      employment_income: saudyaBase * 0.25 + topup1,   // pre-leave work + employer top-up
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
    const topupDesc = topupWeeks > 0
      ? `Her employer tops up to ${topupPct}% of salary for the first ${topupWeeks} weeks.`
      : 'Her employer provides no top-up beyond EI.'
    try {
      const text = await askClaude(
        `Saudya is going on maternity leave in early ${leave1Year} and again around Sep ${leave2Year}. Her regular income is $${saudyaBase.toLocaleString()} base plus $15,000 bonus. EI standard benefit = 55% of insurable earnings. ${topupDesc} Please advise on: (1) optimal RRSP contribution strategy during maternity years, (2) TFSA contributions — should she continue?, (3) income splitting opportunities with Sean (who earns significantly more), (4) impact on FHSA contributions, (5) strategies to minimize combined household tax during these low-income years, (6) EI clawback rules if Saudya earns side income.`,
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

        {/* Core leave settings */}
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
            <label className="label">Base Salary</label>
            <input type="number" className="input" value={saudyaBase} onChange={e => setSaudyaBase(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">EI Weeks (standard=35)</label>
            <input type="number" className="input" value={weeksStandard} onChange={e => setWeeksStandard(Number(e.target.value))} />
          </div>
        </div>

        {/* Employer top-up */}
        <div className="border-t border-slate-700 pt-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-slate-300">Employer Top-Up</span>
            <span className="text-xs text-slate-500">— many employers supplement EI for a fixed number of weeks</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Top-Up Weeks</label>
              <input
                type="number" min={0} max={52} className="input"
                value={topupWeeks}
                onChange={e => setTopupWeeks(Number(e.target.value))}
                placeholder="0"
              />
              <div className="text-xs text-slate-600 mt-1">0 = no top-up</div>
            </div>
            <div>
              <label className="label">Top-Up Target %</label>
              <input
                type="number" min={0} max={100} className="input"
                value={topupPct}
                onChange={e => setTopupPct(Number(e.target.value))}
                placeholder="100"
              />
              <div className="text-xs text-slate-600 mt-1">% of salary employer covers</div>
            </div>
            {topupWeeks > 0 && (
              <div className="col-span-2 flex items-center">
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg px-3 py-2 text-sm text-blue-200/80">
                  Employer pays top-up for <strong className="text-blue-200">{topupWeeks} weeks</strong> — bringing income to{' '}
                  <strong className="text-blue-200">{topupPct}% of salary</strong> (EI covers the base ~55%;
                  employer adds the difference)
                </div>
              </div>
            )}
          </div>
        </div>

        <button onClick={runCalc} className="btn-primary">Calculate Impact</button>
      </div>

      {eiData1 && (
        <>
          {/* EI Benefits */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {[
              { year: leave1Year, data: eiData1, label: 'Leave 1' },
              { year: leave2Year, data: eiData2, label: 'Leave 2' },
            ].map(({ year, data, label }) => {
              const weeklyTopup   = topupWeeks > 0 ? calcWeeklyTopup(saudyaBase, topupPct, data?.weekly_benefit ?? 0) : 0
              const totalTopup    = weeklyTopup * topupWeeks
              const totalLeaveInc = (data?.annual_ei_benefit ?? 0) + totalTopup
              return (
              <div key={year} className="card">
                <h3 className="font-semibold text-slate-200 mb-3">{label} — {year}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">EI Weeks</span><span className="text-slate-200">{data?.weeks}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Weekly EI</span><span className="text-slate-200">{fmt(data?.weekly_benefit ?? 0)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">EI Rate</span><span className="text-slate-200">{data?.benefit_rate_pct}%</span></div>
                  <div className="flex justify-between font-medium border-t border-slate-700 pt-2">
                    <span className="text-slate-400">Annual EI Total</span>
                    <span className="text-blue-300">{fmt(data?.annual_ei_benefit ?? 0)}</span>
                  </div>

                  {/* Employer top-up section */}
                  {topupWeeks > 0 && (
                    <>
                      <div className="border-t border-slate-700 pt-2 mt-1">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">Employer Top-Up</div>
                        <div className="flex justify-between"><span className="text-slate-400">Top-Up Weeks</span><span className="text-slate-200">{topupWeeks} wks</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Top-Up Target</span><span className="text-slate-200">{topupPct}% of salary</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Weekly Top-Up</span><span className="text-emerald-300">{fmt(weeklyTopup)}</span></div>
                        <div className="flex justify-between font-medium mt-1">
                          <span className="text-slate-400">Top-Up Total</span>
                          <span className="text-emerald-300">{fmt(totalTopup)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between font-semibold border-t border-slate-700 pt-2">
                        <span className="text-slate-300">Total Leave Income</span>
                        <span className="text-blue-200">{fmt(totalLeaveInc)}</span>
                      </div>
                    </>
                  )}

                  <div className="text-xs text-amber-300/70 mt-2 border-t border-slate-700 pt-2">
                    ℹ {data?.note}
                  </div>
                </div>
              </div>
              )
            })}
          </div>

          {/* Tax comparison */}
          {taxNormal && taxMat && (
            <div className="card mb-6">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-semibold text-slate-200">Tax Impact — {leave1Year} (Saudya)</h2>
                {topupWeeks > 0 && (
                  <span className="text-xs bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 px-2 py-0.5 rounded-full">
                    Includes {topupWeeks}-week employer top-up
                  </span>
                )}
              </div>
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
