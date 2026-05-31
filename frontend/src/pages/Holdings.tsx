import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAccounts, getHoldings, createHolding, updateHolding, deleteHolding,
  updateAccount, deleteAccount, createAccount,
} from '../api/accounts'
import { fmt, fmtPct } from '../api/client'
import Badge from '../components/ui/Badge'
import { ChevronDown, ChevronRight, Edit2, Save, X, Plus, Trash2, Settings2 } from 'lucide-react'
import type { Holding, Account } from '../types'

// ─── Holding row ────────────────────────────────────────────────────────────

function HoldingRow({ h, onEdit, onDelete }: { h: Holding; onEdit: (h: Holding) => void; onDelete: (h: Holding) => void }) {
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
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(h)} className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors" title="Edit">
            <Edit2 size={13} />
          </button>
          <button onClick={() => onDelete(h)} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors" title="Remove">
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Edit Holding Modal ──────────────────────────────────────────────────────

function EditHoldingModal({ holding, onClose }: { holding: Holding; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    quantity: holding.quantity,
    current_price: holding.current_price,
    price_currency: holding.price_currency,
    book_value_cad: holding.book_value_cad,
    market_value_cad: holding.market_value_cad,
    notes: holding.notes,
  })
  const mut = useMutation({
    mutationFn: () => updateHolding(holding.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holdings'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); onClose() },
  })
  const num = (label: string, key: keyof typeof form) => (
    <div>
      <label className="label">{label}</label>
      <input type="number" step="any" className="input" value={form[key] as number}
        onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))} />
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
          {num('Quantity', 'quantity')}
          <div className="grid grid-cols-2 gap-3">
            {num('Current Price', 'current_price')}
            <div>
              <label className="label">Price Currency</label>
              <select className="input" value={form.price_currency}
                onChange={e => setForm(f => ({ ...f, price_currency: e.target.value }))}>
                <option>CAD</option><option>USD</option>
              </select>
            </div>
          </div>
          {num('Book Value (CAD)', 'book_value_cad')}
          {num('Market Value (CAD)', 'market_value_cad')}
          <div>
            <label className="label">Notes</label>
            <input type="text" className="input" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={() => mut.mutate()} disabled={mut.isPending} className="btn-primary flex-1">
            {mut.isPending ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Tip: after adding all holdings once, use Settings → Import CSV to update prices automatically.
        </p>
      </div>
    </div>
  )
}

// ─── Add Holding Modal ───────────────────────────────────────────────────────

const SECURITY_TYPES = ['ETF', 'Equity', 'Bond', 'Mutual Fund', 'GIC', 'Cash', 'Other']
const EXCHANGES = ['TSX', 'NASDAQ', 'NYSE', 'TSXV', 'Other']

function AddHoldingModal({ accountId, onClose }: { accountId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    account_id: accountId,
    symbol: '',
    name: '',
    exchange: 'TSX',
    security_type: 'ETF',
    quantity: 0,
    book_value_cad: 0,
    current_price: 0,
    price_currency: 'CAD',
    market_value_cad: 0,
    notes: '',
  })
  const mut = useMutation({
    mutationFn: () => createHolding(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holdings'] }); qc.invalidateQueries({ queryKey: ['accounts'] }); onClose() },
  })
  const txt = (label: string, key: keyof typeof form) => (
    <div>
      <label className="label">{label}</label>
      <input type="text" className="input" value={form[key] as string}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
    </div>
  )
  const num = (label: string, key: keyof typeof form) => (
    <div>
      <label className="label">{label}</label>
      <input type="number" step="any" className="input" value={form[key] as number}
        onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))} />
    </div>
  )
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-slate-100">Add Holding</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {txt('Symbol (e.g. VFV)', 'symbol')}
            <div>
              <label className="label">Exchange</label>
              <select className="input" value={form.exchange}
                onChange={e => setForm(f => ({ ...f, exchange: e.target.value }))}>
                {EXCHANGES.map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
          </div>
          {txt('Full Name / Description', 'name')}
          <div>
            <label className="label">Security Type</label>
            <select className="input" value={form.security_type}
              onChange={e => setForm(f => ({ ...f, security_type: e.target.value }))}>
              {SECURITY_TYPES.map(x => <option key={x}>{x}</option>)}
            </select>
          </div>
          {num('Quantity (shares / units)', 'quantity')}
          {num('Book Value / ACB (CAD)', 'book_value_cad')}
          <div className="grid grid-cols-2 gap-3">
            {num('Current Price', 'current_price')}
            <div>
              <label className="label">Price Currency</label>
              <select className="input" value={form.price_currency}
                onChange={e => setForm(f => ({ ...f, price_currency: e.target.value }))}>
                <option>CAD</option><option>USD</option>
              </select>
            </div>
          </div>
          {num('Market Value (CAD)', 'market_value_cad')}
          {txt('Notes (optional)', 'notes')}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.symbol.trim() || !form.name.trim()}
            className="btn-primary flex-1">
            {mut.isPending ? 'Adding…' : 'Add Holding'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Account Modal ──────────────────────────────────────────────────────

const OWNERS = ['sean', 'saudya', 'joint', 'person_a', 'person_b']
const ACCOUNT_TYPES = ['TFSA', 'RRSP', 'FHSA', 'LIRA', 'Margin', 'Cash', 'Joint Non-Reg', 'RESP', 'Other']

function EditAccountModal({ account, onClose }: { account: Account; onClose: () => void }) {
  const qc = useQueryClient()
  const isMargin = account.account_type === 'Margin'
  const [form, setForm] = useState({
    name: account.name,
    account_number: account.account_number,
    owner: account.owner,
    margin_loan_cad: account.margin_loan_cad,
    margin_rate_pct: account.margin_rate_pct,
    margin_portfolio_value_cad: account.margin_portfolio_value_cad ?? 0,
    margin_buying_power_cad: account.margin_buying_power_cad ?? 0,
    margin_available_cad: account.margin_available_cad ?? 0,
    margin_requirement_cad: account.margin_requirement_cad ?? 0,
    notes: account.notes ?? '',
  })
  const mut = useMutation({
    mutationFn: () => updateAccount(account.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); onClose() },
  })
  const numField = (label: string, key: keyof typeof form, help?: string) => (
    <div>
      <label className="label">{label}</label>
      <input type="number" step="any" className="input" value={form[key] as number}
        onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))} />
      {help && <div className="text-xs text-slate-500 mt-0.5">{help}</div>}
    </div>
  )
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-slate-100">Edit Account</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Display Name / Nickname</label>
            <input type="text" className="input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <div className="text-xs text-slate-500 mt-0.5">e.g. ☔️ Rainy Day Fund or 💎 Long Hold Margin</div>
          </div>
          <div>
            <label className="label">Account Number <span className="text-amber-400">(broker format)</span></label>
            <input type="text" className="input font-mono" value={form.account_number}
              onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} />
            <div className="text-xs text-slate-500 mt-0.5">Must match exactly what appears in your broker's CSV export</div>
          </div>
          <div>
            <label className="label">Owner</label>
            <select className="input" value={form.owner}
              onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}>
              {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Margin fields — shown for all accounts so any account can have a loan */}
          <div className="pt-1 border-t border-slate-700">
            <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Margin / Loan Details</div>
            <div className="grid grid-cols-2 gap-3">
              {numField('Loan Outstanding (CAD)', 'margin_loan_cad', 'Amount currently borrowed')}
              {numField('Interest Rate %', 'margin_rate_pct', 'Annual rate on loan')}
            </div>
          </div>

          {isMargin && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500 uppercase tracking-wider pt-1 border-t border-slate-700">
                From Broker Dashboard <span className="normal-case">(copy from Questrade — updates daily)</span>
              </div>
              {numField('Portfolio Value (CAD)', 'margin_portfolio_value_cad', 'Total account value as reported by broker')}
              <div className="grid grid-cols-2 gap-3">
                {numField('Max Buying Power (CAD)', 'margin_buying_power_cad')}
                {numField('Available to Withdraw (CAD)', 'margin_available_cad')}
              </div>
              {numField('Margin Requirement (CAD)', 'margin_requirement_cad', 'Minimum equity required — from broker')}
            </div>
          )}

          <div>
            <label className="label">Notes</label>
            <input type="text" className="input" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        {mut.isError && (
          <div className="mt-3 text-sm text-red-400">
            Save failed — account number may already be in use by another account.
          </div>
        )}
        <div className="flex gap-2 mt-5">
          <button onClick={() => mut.mutate()} disabled={mut.isPending} className="btn-primary flex-1">
            {mut.isPending ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Account Modal ───────────────────────────────────────────────────────

function AddAccountModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: '',
    account_type: 'TFSA',
    owner: 'sean',
    account_number: '',
    currency: 'CAD',
    margin_loan_cad: 0,
    margin_rate_pct: 3.95,
    notes: '',
  })
  const mut = useMutation({
    mutationFn: () => createAccount(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); onClose() },
  })
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-slate-100">Add Account</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Display Name</label>
            <input type="text" className="input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Account Type</label>
              <select className="input" value={form.account_type}
                onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}>
                {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Owner</label>
              <select className="input" value={form.owner}
                onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}>
                <option value="sean">Sean</option>
                <option value="saudya">Saudya</option>
                <option value="joint">Joint</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Account Number (from broker)</label>
            <input type="text" className="input font-mono" value={form.account_number}
              onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} />
          </div>
          {form.account_type === 'Margin' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Margin Loan (CAD)</label>
                <input type="number" step="any" className="input" value={form.margin_loan_cad}
                  onChange={e => setForm(f => ({ ...f, margin_loan_cad: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="label">Margin Rate %</label>
                <input type="number" step="0.01" className="input" value={form.margin_rate_pct}
                  onChange={e => setForm(f => ({ ...f, margin_rate_pct: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.name.trim() || !form.account_number.trim()}
            className="btn-primary flex-1">
            {mut.isPending ? 'Adding…' : 'Add Account'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Account Section ─────────────────────────────────────────────────────────

function AccountSection({ acc }: { acc: Account }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(true)
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null)
  const [editingAccount, setEditingAccount] = useState(false)
  const [addingHolding, setAddingHolding] = useState(false)

  const { data: holdings = [] } = useQuery({
    queryKey: ['holdings', acc.id],
    queryFn: () => getHoldings(acc.id),
  })

  const deleteMut = useMutation({
    mutationFn: (h: Holding) => deleteHolding(h.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holdings'] }); qc.invalidateQueries({ queryKey: ['accounts'] }) },
  })

  const total = holdings.reduce((s, h) => s + h.market_value_cad, 0)
  const gain = holdings.reduce((s, h) => s + h.unrealized_gain_cad, 0)
  const isPlaceholder = acc.account_number.startsWith('PLACEHOLDER')

  const handleDelete = (h: Holding) => {
    if (window.confirm(`Remove ${h.symbol} from this account?`)) deleteMut.mutate(h)
  }

  return (
    <div className={`card mb-4 ${isPlaceholder ? 'border border-amber-700/50' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-3 flex-1 min-w-0">
          {open ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
          <Badge type={acc.account_type} />
          <span className="font-medium text-slate-100 truncate">{acc.name}</span>
          <span className={`text-xs font-mono shrink-0 ${isPlaceholder ? 'text-amber-400' : 'text-slate-500'}`}>
            {isPlaceholder ? '⚠ ' : ''}{acc.account_number}
          </span>
        </button>
        <div className="flex items-center gap-3 ml-3 shrink-0">
          <span className={`text-sm ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {gain >= 0 ? '+' : ''}{fmt(gain)}
          </span>
          <span className="font-semibold text-slate-100">{fmt(total)}</span>
          <button onClick={() => setEditingAccount(true)}
            className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors" title="Edit account">
            <Settings2 size={15} />
          </button>
        </div>
      </div>

      {isPlaceholder && (
        <div className="mb-3 text-xs text-amber-300 bg-amber-900/20 px-3 py-2 rounded-lg">
          ⚠ Placeholder account number — click <Settings2 size={11} className="inline" /> to set the real broker account number before importing CSV.
        </div>
      )}

      {acc.margin_loan_cad > 0 && (
        <div className="mb-3 text-xs text-orange-300 bg-orange-900/20 px-3 py-2 rounded-lg">
          Margin loan: {fmt(acc.margin_loan_cad)} @ {acc.margin_rate_pct}% = {fmt(acc.margin_loan_cad * acc.margin_rate_pct / 100)}/yr interest (tax-deductible)
        </div>
      )}

      {open && (
        <>
          {holdings.length > 0 && (
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
                  {holdings.map(h => (
                    <HoldingRow key={h.id} h={h} onEdit={setEditingHolding} onDelete={handleDelete} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button onClick={() => setAddingHolding(true)}
            className="mt-3 flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-300 transition-colors px-2">
            <Plus size={14} />
            Add holding
          </button>
        </>
      )}

      {editingHolding && <EditHoldingModal holding={editingHolding} onClose={() => setEditingHolding(null)} />}
      {editingAccount && <EditAccountModal account={acc} onClose={() => setEditingAccount(false)} />}
      {addingHolding && <AddHoldingModal accountId={acc.id} onClose={() => setAddingHolding(false)} />}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Holdings() {
  const [addingAccount, setAddingAccount] = useState(false)
  const { data: accounts = [], isLoading } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts })

  const knownOwners = new Set(['sean', 'saudya', 'joint'])
  const grouped = {
    sean:   accounts.filter(a => a.owner === 'sean'),
    saudya: accounts.filter(a => a.owner === 'saudya'),
    joint:  accounts.filter(a => a.owner === 'joint'),
    other:  accounts.filter(a => !knownOwners.has(a.owner)),
  }

  const hasPlaceholders = accounts.some(a => a.account_number.startsWith('PLACEHOLDER'))

  if (isLoading) return <div className="p-8 text-slate-400">Loading…</div>

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Holdings & Accounts</h1>
        <button onClick={() => setAddingAccount(true)} className="btn-secondary flex items-center gap-2 text-sm">
          <Plus size={14} />
          Add Account
        </button>
      </div>

      {hasPlaceholders && (
        <div className="mb-6 p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg text-sm text-amber-300">
          <strong>Setup required:</strong> Some accounts still have placeholder numbers. Click the{' '}
          <Settings2 size={13} className="inline" /> icon on each account to set the real broker account number.
          CSV import won't work until account numbers match your broker export exactly.
        </div>
      )}

      {grouped.other.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-300 mb-3">⚙️ Needs Setup
            <span className="text-sm font-normal text-slate-500 ml-2">(update owner to sean/saudya/joint)</span>
          </h2>
          {grouped.other.map(acc => <AccountSection key={acc.id} acc={acc} />)}
        </div>
      )}

      {(['sean', 'saudya', 'joint'] as const).map(owner => (
        grouped[owner].length > 0 && (
          <div key={owner} className="mb-8">
            <h2 className="text-lg font-semibold text-slate-300 mb-3 capitalize">
              {owner === 'joint' ? '👫 Joint' : owner === 'sean' ? '👤 Sean' : '👤 Saudya'}
            </h2>
            {grouped[owner].map(acc => <AccountSection key={acc.id} acc={acc} />)}
          </div>
        )
      ))}

      {addingAccount && <AddAccountModal onClose={() => setAddingAccount(false)} />}
    </div>
  )
}
