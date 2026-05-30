import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAccounts, getHoldings } from '../api/accounts'
import { getLossHarvestAll } from '../api/ai'
import api from '../api/client'
import { fmt } from '../api/client'
import Badge from '../components/ui/Badge'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import type { Account, Holding, ACBTransaction } from '../types'

function ACBHistory({ holdingId }: { holdingId: number }) {
  const { data = [] } = useQuery<ACBTransaction[]>({
    queryKey: ['acb', holdingId],
    queryFn: () => api.get(`/acb/${holdingId}/history`).then(r => r.data),
  })
  if (data.length === 0) return <div className="text-slate-500 text-sm py-4">No ACB transactions recorded yet. Add your purchase history below.</div>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            {['Date', 'Type', 'Qty', 'Price/Share', 'Fees', 'Total Cost', 'Shares After', 'ACB/Share', 'Total ACB', 'Gain/Loss'].map(h => (
              <th key={h} className="px-3 py-2 text-right first:text-left text-xs text-slate-500 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((t, i) => (
            <tr key={i} className={`border-b border-slate-800 hover:bg-slate-800/30 ${t.superficial_loss_flag ? 'bg-amber-900/10' : ''}`}>
              <td className="px-3 py-2 text-slate-300">{t.date?.slice(0, 10)}</td>
              <td className="px-3 py-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${t.transaction_type === 'buy' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
                  {t.transaction_type}
                </span>
              </td>
              <td className="px-3 py-2 text-right text-slate-300">{t.quantity}</td>
              <td className="px-3 py-2 text-right text-slate-300">{fmt(t.price_per_share_cad, 4)}</td>
              <td className="px-3 py-2 text-right text-slate-400">{fmt(t.fees_cad, 2)}</td>
              <td className="px-3 py-2 text-right text-slate-300">{fmt(t.total_cost_cad)}</td>
              <td className="px-3 py-2 text-right text-slate-300">{t.shares_after.toFixed(4)}</td>
              <td className="px-3 py-2 text-right text-blue-300">{fmt(t.acb_per_share_after, 4)}</td>
              <td className="px-3 py-2 text-right text-slate-100 font-medium">{fmt(t.total_acb_after)}</td>
              <td className={`px-3 py-2 text-right font-medium ${t.capital_gain_loss_cad > 0 ? 'text-emerald-400' : t.capital_gain_loss_cad < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                {t.capital_gain_loss_cad !== 0 ? `${t.capital_gain_loss_cad > 0 ? '+' : ''}${fmt(t.capital_gain_loss_cad)}` : '—'}
                {t.superficial_loss_flag && <span title="Check 30-day superficial loss rule"> ⚠</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AddTransactionForm({ holdingId, onDone }: { holdingId: number; onDone: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    transaction_date: new Date().toISOString().slice(0, 10),
    transaction_type: 'buy',
    quantity: '',
    price_per_share_cad: '',
    fees_cad: '0',
    fx_rate: '1',
    notes: '',
  })
  const mut = useMutation({
    mutationFn: () => api.post('/acb/transaction', { holding_id: holdingId, ...form, quantity: parseFloat(form.quantity), price_per_share_cad: parseFloat(form.price_per_share_cad), fees_cad: parseFloat(form.fees_cad), fx_rate: parseFloat(form.fx_rate) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['acb', holdingId] }); onDone() },
  })
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 p-4 bg-slate-800/50 rounded-lg">
      <div><label className="label">Date</label><input type="date" className="input" value={form.transaction_date} onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))} /></div>
      <div>
        <label className="label">Type</label>
        <select className="input" value={form.transaction_type} onChange={e => setForm(f => ({ ...f, transaction_type: e.target.value }))}>
          {['buy', 'sell', 'reinvest', 'return_of_capital', 'split'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div><label className="label">Quantity</label><input type="number" className="input" placeholder="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></div>
      <div><label className="label">Price/Share (CAD)</label><input type="number" className="input" placeholder="0.00" value={form.price_per_share_cad} onChange={e => setForm(f => ({ ...f, price_per_share_cad: e.target.value }))} /></div>
      <div><label className="label">Fees (CAD)</label><input type="number" className="input" placeholder="0" value={form.fees_cad} onChange={e => setForm(f => ({ ...f, fees_cad: e.target.value }))} /></div>
      <div><label className="label">FX Rate (if USD)</label><input type="number" className="input" placeholder="1.00" value={form.fx_rate} onChange={e => setForm(f => ({ ...f, fx_rate: e.target.value }))} /></div>
      <div className="col-span-2"><label className="label">Notes</label><input type="text" className="input" placeholder="Optional note" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
      <div className="col-span-2 md:col-span-4 flex gap-2 mt-1">
        <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.quantity || !form.price_per_share_cad} className="btn-primary">
          {mut.isPending ? 'Adding…' : 'Add Transaction'}
        </button>
        <button onClick={onDone} className="btn-secondary">Cancel</button>
      </div>
    </div>
  )
}

function HoldingACBPanel({ holding }: { holding: Holding }) {
  const [showAdd, setShowAdd] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const gain = holding.unrealized_gain_cad

  return (
    <div className="border border-slate-700 rounded-lg p-4 mb-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-slate-100">{holding.symbol}</span>
          <span className="text-slate-400 text-sm ml-2">{holding.name}</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400">ACB: <strong className="text-blue-300">{fmt(holding.acb_per_share, 4)}/share</strong></span>
          <span className="text-slate-400">Book: <strong className="text-slate-200">{fmt(holding.book_value_cad)}</strong></span>
          <span className={gain >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {gain >= 0 ? '▲' : '▼'} {fmt(Math.abs(gain))}
          </span>
          <div className="flex gap-2">
            <button onClick={() => setShowHistory(h => !h)} className="text-xs text-slate-400 hover:text-slate-200 underline">
              {showHistory ? 'Hide' : 'History'}
            </button>
            <button onClick={() => setShowAdd(a => !a)} className="btn-secondary text-xs py-1 px-2 flex items-center gap-1">
              <Plus size={12} /> Add
            </button>
          </div>
        </div>
      </div>
      {showHistory && <div className="mt-4"><ACBHistory holdingId={holding.id} /></div>}
      {showAdd && <AddTransactionForm holdingId={holding.id} onDone={() => setShowAdd(false)} />}
    </div>
  )
}

export default function ACBTracker() {
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts })
  const [harvestData, setHarvestData] = useState<any[] | null>(null)
  const [loadingHarvest, setLoadingHarvest] = useState(false)
  const [marginalRate, setMarginalRate] = useState(53)

  const nonRegAccounts = accounts.filter(a =>
    ['Margin', 'Cash', 'Joint Non-Reg'].includes(a.account_type)
  )

  const runHarvestAnalysis = async () => {
    setLoadingHarvest(true)
    try {
      const data = await getLossHarvestAll(marginalRate, 0)
      setHarvestData(data)
    } finally {
      setLoadingHarvest(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">ACB Tracker</h1>
      <p className="text-slate-400 text-sm mb-6">
        Track your Adjusted Cost Base (ACB) for all non-registered holdings.
        CRA requires you to maintain accurate ACB records for capital gains reporting.
      </p>

      {/* Loss harvesting panel */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-slate-100">Capital Loss Harvesting Analysis</h2>
            <p className="text-slate-400 text-sm mt-0.5">Find positions where selling would generate a tax-saving capital loss</p>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <label className="label text-xs">Your marginal rate (%)</label>
              <input type="number" className="input w-20" value={marginalRate} onChange={e => setMarginalRate(Number(e.target.value))} />
            </div>
            <button onClick={runHarvestAnalysis} disabled={loadingHarvest} className="btn-primary">
              {loadingHarvest ? 'Analysing…' : 'Run Analysis'}
            </button>
          </div>
        </div>

        {harvestData && harvestData.length === 0 && (
          <div className="text-emerald-400 text-sm py-2">✓ No significant loss harvesting opportunities right now.</div>
        )}

        {harvestData && harvestData.map((item, i) => (
          <div key={i} className="border border-amber-700/40 bg-amber-900/10 rounded-lg p-4 mb-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-amber-200">{item.symbol} — {item.holding_name}</div>
                <div className="text-xs text-slate-400 mb-2">{item.account} ({item.account_type})</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><div className="label">Unrealized Loss</div><div className="text-red-400 font-medium">{fmt(item.unrealized_loss)}</div></div>
                  <div><div className="label">Usable vs YTD Gains</div><div className="text-slate-200">{fmt(item.usable_against_ytd_gains)}</div></div>
                  <div><div className="label">Tax Saved Now</div><div className="text-emerald-400 font-medium">{fmt(item.estimated_tax_saved_now)}</div></div>
                  <div><div className="label">Carryforward Value</div><div className="text-blue-300">{fmt(item.estimated_tax_saved_carryforward)}</div></div>
                </div>
                <div className="mt-2 text-xs text-amber-300/70 bg-amber-900/20 rounded p-2">
                  ⚠ {item.superficial_loss_warning}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ACB by account */}
      {nonRegAccounts.map(acc => (
        <AccountACBSection key={acc.id} acc={acc} />
      ))}

      <div className="mt-6 p-4 bg-slate-800/40 rounded-xl text-xs text-slate-500">
        <strong className="text-slate-400">CRA Rules:</strong> ACB must be calculated on a per-security, per-account basis.
        When you sell, your capital gain = Proceeds − (ACB per share × shares sold) − commissions.
        50% of the gain is included in your taxable income (2026). Capital losses can be carried back 3 years or forward indefinitely.
        The superficial loss rule (ITA s.54) denies a loss if you repurchase the identical security within 30 days before or after the sale.
      </div>
    </div>
  )
}

function AccountACBSection({ acc }: { acc: Account }) {
  const { data: holdings = [] } = useQuery({
    queryKey: ['holdings', acc.id],
    queryFn: () => getHoldings(acc.id),
  })
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Badge type={acc.account_type} />
        <span className="font-medium text-slate-200">{acc.name}</span>
        <span className="text-xs text-slate-500">({acc.owner})</span>
      </div>
      {holdings.map(h => <HoldingACBPanel key={h.id} holding={h} />)}
    </div>
  )
}
