import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query'
import { getAccounts, getHoldings } from '../api/accounts'
import { getLossHarvestAll } from '../api/ai'
import api from '../api/client'
import { fmt } from '../api/client'
import Badge from '../components/ui/Badge'
import { AlertTriangle, Plus, Calculator, TrendingDown } from 'lucide-react'
import type { Account, Holding, ACBTransaction } from '../types'

// ─── ACB History table ────────────────────────────────────────────────────────

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

// ─── Add transaction form ─────────────────────────────────────────────────────

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
    mutationFn: () => api.post('/acb/transaction', {
      holding_id: holdingId, ...form,
      quantity: parseFloat(form.quantity),
      price_per_share_cad: parseFloat(form.price_per_share_cad),
      fees_cad: parseFloat(form.fees_cad),
      fx_rate: parseFloat(form.fx_rate),
    }),
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

// ─── Holding ACB panel ────────────────────────────────────────────────────────

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

// ─── What-If Sale Calculator ──────────────────────────────────────────────────

type LossCandidate = Holding & { accountName: string; accountOwner: string; isJoint: boolean }

function SaleCalculator({ accounts }: { accounts: Account[] }) {
  const nonRegAccounts = accounts.filter(a =>
    ['Margin', 'Cash', 'Joint Non-Reg'].includes(a.account_type)
  )

  // Load holdings for every non-reg account upfront (cached alongside the ACB section below)
  const holdingsResults = useQueries({
    queries: nonRegAccounts.map(acc => ({
      queryKey: ['holdings', acc.id],
      queryFn: () => getHoldings(acc.id),
    })),
  })

  const holdingsByAccId: Record<number, Holding[]> = Object.fromEntries(
    nonRegAccounts.map((acc, i) => [acc.id, holdingsResults[i].data ?? []])
  )

  // Sale inputs
  // Suggested marginal rates per owner — update these to match current income
  const RATE_SUGGESTIONS: Record<string, number> = {
    sean:  53,   // top federal+ON bracket
    saudya: 43,  // mid bracket
    joint:  43,  // default to lower earner for joint gains
  }

  const [selAccId,  setSelAccId]  = useState<number | null>(null)
  const [selHoldId, setSelHoldId] = useState<number | null>(null)
  const [saleInput, setSaleInput] = useState('')
  const [mode, setMode]           = useState<'dollars' | 'shares'>('dollars')
  const [margRate, setMargRate]   = useState(43)
  const [margRateEdited, setMargRateEdited] = useState(false)
  // Map<holdingId, dollarAmountToRealise> — not in map means unselected
  const [offsetIds, setOffsetIds] = useState<Map<number, number>>(new Map())

  const selAcc     = nonRegAccounts.find(a => a.id === selAccId) ?? null
  const accHoldings = selAccId ? (holdingsByAccId[selAccId] ?? []) : []
  const selHolding  = accHoldings.find(h => h.id === selHoldId) ?? null

  // Loss candidates: any non-reg holding with an unrealized loss, excluding the sale holding
  const lossCandidates: LossCandidate[] = nonRegAccounts.flatMap((acc, i) =>
    (holdingsResults[i].data ?? [])
      .filter(h => h.unrealized_gain_cad < -100 && h.id !== selHoldId)
      .map(h => ({ ...h, accountName: acc.name, accountOwner: acc.owner, isJoint: acc.owner === 'joint' }))
  )

  // offsetAmounts: holding id → dollar amount of loss to realise (not in map = not selected)
  const toggleOffset = (h: LossCandidate) => {
    const fullLoss = h.isJoint
      ? Math.abs(h.unrealized_gain_cad) / 2
      : Math.abs(h.unrealized_gain_cad)
    setOffsetIds(prev => {
      const next = new Map(prev)
      if (next.has(h.id)) {
        next.delete(h.id)
      } else {
        // Default to the minimum needed to cover remaining uncovered gain
        const alreadyCovered = [...next.values()].reduce((s, v) => s + v, 0)
        const stillNeeded = Math.max(0, yourGain - alreadyCovered)
        next.set(h.id, stillNeeded > 0 ? Math.min(stillNeeded, fullLoss) : fullLoss)
      }
      return next
    })
  }

  const setOffsetAmount = (id: number, amount: number, maxAmount: number) => {
    setOffsetIds(prev => {
      const next = new Map(prev)
      if (next.has(id)) next.set(id, Math.min(Math.max(0, amount), maxAmount))
      return next
    })
  }

  // ── Capital gain calculation ─────────────────────────────────────────────────
  const saleNum = parseFloat(saleInput) || 0
  let proceeds   = 0
  let sharesSold = 0
  let acbBasis   = 0
  let grossGain  = 0

  if (selHolding && saleNum > 0 && selHolding.current_price > 0) {
    if (mode === 'dollars') {
      proceeds   = saleNum
      sharesSold = saleNum / selHolding.current_price
    } else {
      sharesSold = saleNum
      proceeds   = saleNum * selHolding.current_price
    }
    acbBasis  = sharesSold * selHolding.acb_per_share
    grossGain = proceeds - acbBasis
  }

  const isJoint = selAcc?.owner === 'joint'
  // For joint accounts: 50/50 split on the gain
  const yourGain = isJoint ? grossGain / 2 : grossGain

  // Sum of user-entered partial amounts — no automatic scaling by joint split here
  // because the user enters their share amount directly in the input
  const totalOffset = [...offsetIds.values()].reduce((s, v) => s + v, 0)

  const netGain    = Math.max(0, yourGain - totalOffset)
  const excessLoss = Math.max(0, totalOffset - yourGain)  // carry-forward amount
  const hasResult  = selHolding && saleNum > 0

  // Tax at 50% inclusion rate
  const taxNoOffset   = yourGain  > 0 ? yourGain  * 0.5 * (margRate / 100) : 0
  const taxWithOffset = netGain   > 0 ? netGain   * 0.5 * (margRate / 100) : 0
  const taxSaved      = taxNoOffset - taxWithOffset

  return (
    <div className="card mb-8 border border-blue-800/30">
      <div className="flex items-center gap-2 mb-5">
        <Calculator size={18} className="text-blue-400 shrink-0" />
        <h2 className="font-semibold text-slate-100">What-If Sale Calculator</h2>
        <span className="text-xs text-slate-500 ml-1">
          Model a partial sale, apply loss harvesting, and see the real tax cost
        </span>
      </div>

      {/* Step 1 — Pick holding + sale amount */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
        <div>
          <label className="label">Account</label>
          <select
            className="input"
            value={selAccId ?? ''}
            onChange={e => {
              const newId = e.target.value ? Number(e.target.value) : null
              setSelAccId(newId)
              setSelHoldId(null)
              setSaleInput('')
              setOffsetIds(new Map())
              // Auto-suggest marginal rate for this account's owner (unless user has manually changed it)
              if (!margRateEdited && newId) {
                const acc = nonRegAccounts.find(a => a.id === newId)
                if (acc) setMargRate(RATE_SUGGESTIONS[acc.owner] ?? 43)
              }
            }}
          >
            <option value="">— pick account —</option>
            {nonRegAccounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.name}{a.owner === 'joint' ? ' (Joint)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Holding</label>
          <select
            className="input"
            value={selHoldId ?? ''}
            disabled={!selAccId}
            onChange={e => {
              setSelHoldId(e.target.value ? Number(e.target.value) : null)
              setSaleInput('')
              setOffsetIds(new Map())
            }}
          >
            <option value="">— pick holding —</option>
            {accHoldings.map(h => (
              <option key={h.id} value={h.id}>
                {h.symbol} — {fmt(h.market_value_cad)} ({h.unrealized_gain_cad >= 0 ? '+' : ''}{fmt(h.unrealized_gain_cad)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">
            Sale Amount
            <button
              className="ml-2 text-xs text-blue-400 hover:text-blue-300"
              onClick={() => { setMode(m => m === 'dollars' ? 'shares' : 'dollars'); setSaleInput('') }}
            >
              [{mode === 'dollars' ? 'switch to shares' : 'switch to $'}]
            </button>
          </label>
          <div className="relative">
            {mode === 'dollars' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>}
            <input
              type="number"
              min={0}
              className={`input ${mode === 'dollars' ? 'pl-7' : ''}`}
              placeholder={mode === 'dollars' ? '5000' : '# shares'}
              value={saleInput}
              onChange={e => setSaleInput(e.target.value)}
              disabled={!selHoldId}
            />
          </div>
          {selHolding && mode === 'dollars' && saleNum > 0 && (
            <div className="text-xs text-slate-500 mt-1">{sharesSold.toFixed(4)} shares @ {fmt(selHolding.current_price)}</div>
          )}
        </div>

        <div>
          <label className="label">
            Marginal Rate (%)
            {selAcc && !margRateEdited && (
              <span className="ml-2 text-xs text-blue-400 font-normal">
                suggested for {selAcc.owner}
              </span>
            )}
            {margRateEdited && (
              <button
                className="ml-2 text-xs text-slate-500 hover:text-slate-300 underline font-normal"
                onClick={() => {
                  if (selAcc) setMargRate(RATE_SUGGESTIONS[selAcc.owner] ?? 43)
                  setMargRateEdited(false)
                }}
              >
                reset to suggested
              </button>
            )}
          </label>
          <input
            type="number"
            className="input"
            value={margRate}
            onChange={e => { setMargRate(Number(e.target.value)); setMargRateEdited(true) }}
          />
          <div className="text-xs text-slate-500 mt-1">Sean ~53% · Saudya ~43% · Joint: use lower earner's rate</div>
        </div>
      </div>

      {/* Step 2 — Gain breakdown */}
      {hasResult && (
        <div className="bg-slate-800/50 rounded-xl p-4 mb-5">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Capital Gain Breakdown</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-slate-500 mb-0.5">Proceeds</div>
              <div className="text-slate-100 font-medium">{fmt(proceeds)}</div>
            </div>
            <div>
              <div className="text-slate-500 mb-0.5">ACB Basis</div>
              <div className="text-slate-100 font-medium">−{fmt(acbBasis)}</div>
              <div className="text-xs text-slate-600">{fmt(selHolding!.acb_per_share, 4)}/share × {sharesSold.toFixed(4)} shares</div>
            </div>
            <div>
              <div className="text-slate-500 mb-0.5">Gross Capital Gain</div>
              <div className={`font-semibold ${grossGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{grossGain >= 0 ? '+' : ''}{fmt(grossGain)}</div>
            </div>
            {isJoint && (
              <div>
                <div className="text-slate-500 mb-0.5">Your Share (50%)</div>
                <div className={`font-semibold ${yourGain >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>{fmt(yourGain)}</div>
                <div className="text-xs text-slate-600">Joint account — split equally</div>
              </div>
            )}
          </div>

          {grossGain < 0 && (
            <div className="mt-3 text-xs text-amber-300/80 bg-amber-900/20 border border-amber-700/30 rounded-lg p-2">
              ⚠ This sale would realize a <strong>capital loss</strong> of {fmt(Math.abs(grossGain))}
              {isJoint ? ` (your share: ${fmt(Math.abs(yourGain))})` : ''}. Losses can offset gains realized this year or be carried forward indefinitely.
            </div>
          )}
          {selHolding!.acb_per_share === 0 && (
            <div className="mt-3 text-xs text-amber-300/80 bg-amber-900/20 border border-amber-700/30 rounded-lg p-2">
              ⚠ No ACB recorded for this holding — add transaction history below for an accurate gain calculation.
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Loss offset selection */}
      {hasResult && grossGain > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={15} className="text-red-400 shrink-0" />
            <span className="text-sm font-medium text-slate-300">Apply Capital Losses to Offset</span>
          </div>
          <p className="text-xs text-slate-500 mb-3 ml-5">
            Check a position to harvest it alongside this sale. You don't have to realise the full loss —
            adjust the amount to sell only what you need to offset the gain.
          </p>

          {lossCandidates.length === 0 ? (
            <div className="text-slate-500 text-sm bg-slate-800/40 rounded-lg p-3">
              No unrealized losses found in your non-registered accounts.
            </div>
          ) : (
            <div className="space-y-2">
              {lossCandidates.map(h => {
                const fullLoss = h.isJoint
                  ? Math.abs(h.unrealized_gain_cad) / 2
                  : Math.abs(h.unrealized_gain_cad)
                const checked      = offsetIds.has(h.id)
                const chosenAmount = offsetIds.get(h.id) ?? 0
                const pct          = fullLoss > 0 ? Math.round((chosenAmount / fullLoss) * 100) : 0
                const sharesToSell = h.current_price > 0 ? chosenAmount / h.current_price : 0

                return (
                  <div
                    key={h.id}
                    className={`rounded-lg border transition-colors ${checked
                      ? 'bg-red-900/20 border-red-700/50'
                      : 'bg-slate-800/40 border-slate-700/50'}`}
                  >
                    {/* Checkbox row */}
                    <label className="flex items-center gap-3 p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-red-500 shrink-0"
                        checked={checked}
                        onChange={() => toggleOffset(h)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-200">{h.symbol}</span>
                          <span className="text-xs text-slate-500">{h.accountName}</span>
                          {h.isJoint && <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">Joint</span>}
                        </div>
                        <div className="text-xs text-slate-400 truncate">{h.name}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-red-400 font-medium text-sm">Max loss: {fmt(fullLoss)}</div>
                        {h.isJoint && (
                          <div className="text-xs text-slate-500">your 50% of {fmt(Math.abs(h.unrealized_gain_cad))}</div>
                        )}
                      </div>
                    </label>

                    {/* Partial amount controls — shown when checked */}
                    {checked && (
                      <div className="px-3 pb-3 border-t border-red-900/40 pt-2 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-slate-500 mb-1 block">
                              Loss amount to realise <span className="text-red-400 ml-1">{pct}% of position</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                              <input
                                type="number"
                                min={0}
                                max={fullLoss}
                                step={100}
                                className="input pl-7"
                                value={chosenAmount}
                                onChange={e => setOffsetAmount(h.id, Number(e.target.value), fullLoss)}
                              />
                            </div>
                          </div>
                          <div className="shrink-0 text-right text-xs text-slate-500 pt-4">
                            <div>≈ {sharesToSell.toFixed(4)} shares</div>
                            <div className="text-slate-600">@ {fmt(h.current_price)}/share</div>
                          </div>
                        </div>
                        {/* Quick-set buttons */}
                        <div className="flex gap-2">
                          {[
                            { label: 'Just enough', val: Math.min(fullLoss, Math.max(0, yourGain - (totalOffset - chosenAmount))) },
                            { label: '50%', val: fullLoss * 0.5 },
                            { label: '100%', val: fullLoss },
                          ].map(({ label, val }) => (
                            <button
                              key={label}
                              onClick={() => setOffsetAmount(h.id, Math.round(val), fullLoss)}
                              className="text-xs px-2 py-1 rounded border border-slate-600 text-slate-400 hover:border-red-600 hover:text-red-300 transition-colors"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 4 — Summary */}
      {hasResult && (
        <div className={`rounded-xl border p-4 ${netGain === 0 && offsetIds.size > 0 && totalOffset > 0
          ? 'bg-emerald-900/20 border-emerald-700/40'
          : grossGain > 0
            ? 'bg-slate-800/60 border-slate-600/40'
            : 'bg-slate-800/40 border-slate-700/40'}`}
        >
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Net Tax Impact</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-slate-500 mb-0.5">Gross Gain (your share)</div>
              <div className={`font-semibold ${yourGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {yourGain >= 0 ? '+' : ''}{fmt(yourGain)}
              </div>
            </div>
            {offsetIds.size > 0 && totalOffset > 0 && (
              <div>
                <div className="text-slate-500 mb-0.5">Losses Applied</div>
                <div className="text-red-400 font-semibold">−{fmt(totalOffset)}</div>
              </div>
            )}
            <div>
              <div className="text-slate-500 mb-0.5">Net Taxable Gain</div>
              <div className={`font-semibold ${netGain === 0 ? 'text-emerald-400' : 'text-slate-100'}`}>
                {netGain === 0 ? 'Fully offset ✓' : fmt(netGain)}
              </div>
              {netGain > 0 && <div className="text-xs text-slate-600">50% included = {fmt(netGain * 0.5)} taxable</div>}
            </div>
            <div>
              <div className="text-slate-500 mb-0.5">
                {offsetIds.size > 0 && totalOffset > 0 ? 'Tax Owed (after offset)' : 'Estimated Tax Owed'}
              </div>
              <div className={`font-semibold ${taxWithOffset === 0 ? 'text-emerald-400' : 'text-orange-300'}`}>
                {taxWithOffset === 0 ? '$0' : fmt(taxWithOffset)}
              </div>
              {taxSaved > 0 && offsetIds.size > 0 && totalOffset > 0 && (
                <div className="text-xs text-emerald-500 mt-0.5">saves {fmt(taxSaved)} vs. selling alone</div>
              )}
            </div>
          </div>

          {excessLoss > 0 && (
            <div className="mt-3 text-xs text-blue-300/80 bg-blue-900/20 border border-blue-700/30 rounded-lg p-2">
              💡 <strong>{fmt(excessLoss)}</strong> of unused losses would carry forward — they can offset any capital gains in future years (or be carried back 3 years).
            </div>
          )}

          <div className="mt-3 text-xs text-slate-600">
            Calculation: (Proceeds − ACB) × 50% inclusion × {margRate}% marginal rate.
            {isJoint ? ' Joint account gains are split 50/50 for tax purposes.' : ''}
            {' '}Verify with your accountant before filing.
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Account ACB section ──────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ACBTracker() {
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts })
  const [harvestData, setHarvestData]     = useState<any[] | null>(null)
  const [loadingHarvest, setLoadingHarvest] = useState(false)
  const [marginalRate, setMarginalRate]   = useState(53)
  const [ownerFilter, setOwnerFilter]     = useState<'all' | 'sean' | 'saudya' | 'joint'>('all')

  const nonRegAccounts = accounts.filter(a =>
    ['Margin', 'Cash', 'Joint Non-Reg'].includes(a.account_type)
  )

  const filteredAccounts = ownerFilter === 'all'
    ? nonRegAccounts
    : nonRegAccounts.filter(a => a.owner === ownerFilter)

  // Derive which owners actually have non-reg accounts
  const availableOwners = Array.from(new Set(nonRegAccounts.map(a => a.owner)))

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

      {/* ── What-If Sale Calculator ── */}
      <SaleCalculator accounts={accounts} />

      {/* ── Loss harvesting panel ── */}
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

      {/* ── ACB by account ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-100">ACB by Account</h2>
        <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
          {(['all', ...availableOwners] as const).map(owner => (
            <button
              key={owner}
              onClick={() => setOwnerFilter(owner as typeof ownerFilter)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                ownerFilter === owner
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {owner === 'all' ? 'All' : owner}
            </button>
          ))}
        </div>
      </div>

      {filteredAccounts.length === 0 && (
        <div className="text-slate-500 text-sm text-center py-8">
          No non-registered accounts for {ownerFilter}.
        </div>
      )}

      {filteredAccounts.map(acc => (
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
