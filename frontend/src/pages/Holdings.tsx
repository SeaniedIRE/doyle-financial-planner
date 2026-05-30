import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAccounts, getHoldings, updateHolding, updateAccount } from '../api/accounts'
import { fmt, fmtPct } from '../api/client'
import Badge from '../components/ui/Badge'
import { ChevronDown, ChevronRight, Edit2, Save, X } from 'lucide-react'
import type { Holding, Account } from '../types'

function HoldingRow({ h, onEdit }: { h: Holding; onEdit: (h: Holding) => void }) {
  const gain = h.unrealized_gain_cad
  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/50">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-100">{h.symbol}</div>
        <div className="text-xs text-slate-500 max-w-[180px] truncate">{h.name}</div>
        {h.notes && <div className="text-xs text-amber-400 mt-0.5 max-w-[220px]">⚠ {h.notes}</div>}
      </td>
      <td className="px-4 py-3 text-right text-slate-300">{h.quantity.toLocaleString('en-CA', { maximumFractionDigits: 4 })}</td>
      <td className="px-4 py-3 text-right text-slate-300">{fmt(h.current_price, 2)} <span className="text-xs text-slate-500">{h.price_currency}</span></td>
      <td className="px-4 py-3 text-right text-slate-300">{fmt(h.book_value_cad)}</td>
      <td className="px-4 py-3 text-right font-medium text-slate-100">{fmt(h.market_value_cad)}</td>
      <td className={`px-4 py-3 text-right font-medium ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {gain >= 0 ? '+' : ''}{fmt(gain)}
        <div className="text-xs">{fmtPct(h.unrealized_pct)}</div>
      </td>
      <td className="px-4 py-3 text-right text-slate-400 text-sm">{fmt(h.acb_per_share, 4)}</td>
      <td className="px-4 py-3">
        <button onClick={() => onEdit(h)} className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors">
          <Edit2 size={14} />
        </button>
      </td>
    </tr>
  )
}

function EditHoldingModal({ holding, onClose }: { holding: Holding; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    quantity: holding.quantity,
    current_price: holding.current_price,
    book_value_cad: holding.book_value_cad,
    market_value_cad: holding.market_value_cad,
    notes: holding.notes,
  })
  const mut = useMutation({
    mutationFn: () => updateHolding(holding.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holdings'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); onClose() },
  })
  const field = (label: string, key: keyof typeof form, type: 'number' | 'text' = 'number') => (
    <div>
      <label className="label">{label}</label>
      <input type={type} className="input" value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))} />
    </div>
  )
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-slate-100">Edit {holding.symbol}</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          {field('Quantity', 'quantity')}
          {field('Current Price', 'current_price')}
          {field('Book Value (CAD)', 'book_value_cad')}
          {field('Market Value (CAD)', 'market_value_cad')}
          {field('Notes', 'notes', 'text')}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={() => mut.mutate()} disabled={mut.isPending} className="btn-primary flex-1">
            {mut.isPending ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Tip: Import fresh values by uploading your broker's CSV in Settings → Import Holdings.
        </p>
      </div>
    </div>
  )
}

function AccountSection({ acc }: { acc: Account }) {
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState<Holding | null>(null)
  const { data: holdings = [] } = useQuery({
    queryKey: ['holdings', acc.id],
    queryFn: () => getHoldings(acc.id),
  })

  const total = holdings.reduce((s, h) => s + h.market_value_cad, 0)
  const gain = holdings.reduce((s, h) => s + h.unrealized_gain_cad, 0)

  return (
    <div className="card mb-4">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
          <Badge type={acc.account_type} />
          <span className="font-medium text-slate-100">{acc.name}</span>
          <span className="text-xs text-slate-500">{acc.account_number}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-sm ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {gain >= 0 ? '+' : ''}{fmt(gain)}
          </span>
          <span className="font-semibold text-slate-100">{fmt(total)}</span>
        </div>
      </button>

      {acc.margin_loan_cad > 0 && (
        <div className="mb-3 text-xs text-orange-300 bg-orange-900/20 px-3 py-2 rounded-lg">
          Margin loan: {fmt(acc.margin_loan_cad)} @ {acc.margin_rate_pct}% = {fmt(acc.margin_loan_cad * acc.margin_rate_pct / 100)}/yr interest (tax-deductible)
        </div>
      )}

      {open && holdings.length > 0 && (
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {['Security', 'Qty', 'Price', 'Book Value', 'Market Value', 'Unrealized', 'ACB/Share', ''].map(h => (
                  <th key={h} className="px-4 py-2 text-right first:text-left text-xs text-slate-500 uppercase tracking-wider font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {holdings.map(h => <HoldingRow key={h.id} h={h} onEdit={setEditing} />)}
            </tbody>
          </table>
        </div>
      )}
      {editing && <EditHoldingModal holding={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

export default function Holdings() {
  const { data: accounts = [], isLoading } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts })

  const grouped = {
    sean: accounts.filter(a => a.owner === 'sean'),
    saudya: accounts.filter(a => a.owner === 'saudya'),
    joint: accounts.filter(a => a.owner === 'joint'),
  }

  if (isLoading) return <div className="p-8 text-slate-400">Loading…</div>

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Holdings & Accounts</h1>

      {(['sean', 'saudya', 'joint'] as const).map(owner => (
        <div key={owner} className="mb-8">
          <h2 className="text-lg font-semibold text-slate-300 mb-3 capitalize">
            {owner === 'joint' ? '👫 Joint' : owner === 'sean' ? '👤 Sean' : '👤 Saudya'}
          </h2>
          {grouped[owner].map(acc => <AccountSection key={acc.id} acc={acc} />)}
        </div>
      ))}
    </div>
  )
}
