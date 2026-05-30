import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getAccounts, getHoldings } from '../api/accounts'
import { getFHSAStrategy } from '../api/ai'
import { fmt } from '../api/client'
import ReactMarkdown from 'react-markdown'
import { Home, Bot } from 'lucide-react'

export default function HousePlanning() {
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts })
  const [houseYear, setHouseYear] = useState(2030)
  const [housePrice, setHousePrice] = useState(900000)
  const [advice, setAdvice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fhsaAccounts = accounts.filter(a => a.account_type === 'FHSA')
  const rrspAccounts = accounts.filter(a => a.account_type === 'RRSP')

  const seanFHSA = fhsaAccounts.filter(a => a.owner === 'sean').reduce((s, a) => s + a.total_market_value_cad, 0)
  const saudyaFHSA = fhsaAccounts.filter(a => a.owner === 'saudya').reduce((s, a) => s + a.total_market_value_cad, 0)
  const seanRRSP = rrspAccounts.filter(a => a.owner === 'sean').reduce((s, a) => s + a.total_market_value_cad, 0)
  const saudyaRRSP = rrspAccounts.filter(a => a.owner === 'saudya').reduce((s, a) => s + a.total_market_value_cad, 0)

  const totalFHSA = seanFHSA + saudyaFHSA
  const hbpMax = 35000 * 2  // Home Buyers' Plan: $35K each
  const totalAvailable = totalFHSA + hbpMax
  const downPctOfPrice = (totalAvailable / housePrice) * 100

  const getAIAdvice = async () => {
    setLoading(true)
    try {
      const text = await getFHSAStrategy(houseYear, housePrice)
      setAdvice(text)
    } finally {
      setLoading(false)
    }
  }

  const yearsUntilPurchase = houseYear - 2026

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">House Planning</h1>
      <p className="text-slate-400 text-sm mb-6">FHSA + RRSP Home Buyers' Plan strategy for your first home purchase</p>

      {/* Settings */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Target Purchase Year</label>
            <select className="input" value={houseYear} onChange={e => setHouseYear(Number(e.target.value))}>
              {[2029, 2030, 2031, 2032, 2033].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Estimated House Price</label>
            <input type="number" className="input" value={housePrice} onChange={e => setHousePrice(Number(e.target.value))} step={25000} />
          </div>
        </div>
        <div className="text-sm text-slate-400">
          {yearsUntilPurchase} years away — accounts will continue compounding until then.
        </div>
      </div>

      {/* Available funds */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="text-xs text-slate-500 mb-1">Sean FHSA</div>
          <div className="text-lg font-bold text-purple-300">{fmt(seanFHSA)}</div>
          <div className="text-xs text-slate-500 mt-1">+$8K room remaining</div>
        </div>
        <div className="card">
          <div className="text-xs text-slate-500 mb-1">Saudya FHSA</div>
          <div className="text-lg font-bold text-purple-300">{fmt(saudyaFHSA)}</div>
          <div className="text-xs text-slate-500 mt-1">+$8K room remaining</div>
        </div>
        <div className="card">
          <div className="text-xs text-slate-500 mb-1">RRSP HBP (Sean)</div>
          <div className="text-lg font-bold text-blue-300">{fmt(35000)}</div>
          <div className="text-xs text-slate-500 mt-1">Max HBP withdrawal</div>
        </div>
        <div className="card">
          <div className="text-xs text-slate-500 mb-1">RRSP HBP (Saudya)</div>
          <div className="text-lg font-bold text-blue-300">{fmt(35000)}</div>
          <div className="text-xs text-slate-500 mt-1">Max HBP withdrawal</div>
        </div>
      </div>

      {/* Down payment analysis */}
      <div className="card mb-6">
        <h2 className="font-semibold text-slate-100 mb-4">Down Payment Analysis — {houseYear}</h2>
        <div className="space-y-3 text-sm">
          {[
            { label: 'FHSA (Sean + Saudya)', value: totalFHSA, note: 'Tax-free withdrawal — no repayment required', color: 'text-purple-300' },
            { label: 'RRSP HBP (Sean + Saudya)', value: hbpMax, note: 'Must repay over 15 years to RRSP or taxed as income', color: 'text-blue-300' },
            { label: 'Total available', value: totalAvailable, note: `${downPctOfPrice.toFixed(1)}% of ${fmt(housePrice)} purchase`, color: 'text-emerald-400' },
          ].map(({ label, value, note, color }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
              <div>
                <div className="font-medium text-slate-200">{label}</div>
                <div className="text-xs text-slate-500">{note}</div>
              </div>
              <div className={`text-lg font-bold ${color}`}>{fmt(value)}</div>
            </div>
          ))}
        </div>

        {downPctOfPrice >= 20 ? (
          <div className="mt-4 bg-emerald-900/20 border border-emerald-700/40 rounded-lg p-3 text-sm text-emerald-300">
            ✓ Down payment ≥20% — no CMHC mortgage insurance required. Estimated savings: ~{fmt(housePrice * 0.04)} in CMHC premiums.
          </div>
        ) : (
          <div className="mt-4 bg-amber-900/20 border border-amber-700/40 rounded-lg p-3 text-sm text-amber-300">
            ⚠ Down payment {downPctOfPrice.toFixed(1)}% — below 20%, CMHC mortgage insurance will apply (~{fmt(housePrice * 0.031)}).
          </div>
        )}
      </div>

      {/* Rules reference */}
      <div className="card mb-6">
        <h2 className="font-semibold text-slate-100 mb-4">📖 Key Rules</h2>
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="text-purple-300 font-medium mb-2">FHSA Qualifying Withdrawal</h3>
            <ul className="text-slate-400 space-y-1">
              <li>• Must be a first-time home buyer</li>
              <li>• FHSA must be open for at least 1 calendar year before withdrawal</li>
              <li>• Must have a written purchase agreement for a qualifying home</li>
              <li>• Withdrawal is completely tax-free (no repayment)</li>
              <li>• Sean & Saudya can each withdraw their full FHSA balance</li>
              <li>• Unused FHSA balance can be transferred to RRSP tax-free if house not purchased</li>
            </ul>
          </div>
          <div>
            <h3 className="text-blue-300 font-medium mb-2">RRSP Home Buyers' Plan (HBP)</h3>
            <ul className="text-slate-400 space-y-1">
              <li>• Each person can withdraw up to $35,000 from their RRSP</li>
              <li>• Must repay over 15 years (1/15 per year minimum)</li>
              <li>• Missed repayments added to taxable income that year</li>
              <li>• Works alongside FHSA — use both for maximum down payment</li>
              <li>• RRSP contributions must be in the account for 90+ days before HBP withdrawal</li>
            </ul>
          </div>
        </div>
      </div>

      {/* AI Advice */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-100 flex items-center gap-2"><Bot size={18} /> AI Strategy Advice</h2>
          <button onClick={getAIAdvice} disabled={loading} className="btn-primary flex items-center gap-2 text-sm">
            {loading ? 'Asking Claude…' : 'Get AI Strategy'}
          </button>
        </div>
        {advice && (
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown>{advice}</ReactMarkdown>
          </div>
        )}
        {!advice && <div className="text-slate-500 text-sm">Click "Get AI Strategy" for Claude's personalized FHSA + HBP withdrawal plan</div>}
      </div>
    </div>
  )
}
