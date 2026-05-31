import { useQuery } from '@tanstack/react-query'
import { getAccounts, getPortfolioTotals } from '../api/accounts'
import { fmt } from '../api/client'
import Badge from '../components/ui/Badge'
import { TrendingUp, AlertTriangle, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Account } from '../types'

const OWNER_LABELS: Record<string, string> = { sean: 'Sean', saudya: 'Saudya', joint: 'Joint' }

// ─── Margin Detail Card ──────────────────────────────────────────────────────

function MarginCard({ accounts }: { accounts: Account[] }) {
  const marginAccounts = accounts.filter(a => a.account_type === 'Margin' && a.margin_loan_cad > 0)
  if (marginAccounts.length === 0) return null

  const totalLoan     = marginAccounts.reduce((s, a) => s + a.margin_loan_cad, 0)
  const totalInterest = marginAccounts.reduce((s, a) => s + (a.margin_loan_cad * a.margin_rate_pct / 100), 0)
  const totalMarket   = marginAccounts.reduce((s, a) => s + a.total_market_value_cad, 0)
  const totalNetEquity = totalMarket - totalLoan

  return (
    <div className="mb-6 bg-orange-950/30 border border-orange-700/40 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Info size={16} className="text-orange-400 shrink-0" />
        <span className="text-orange-300 font-medium text-sm">Margin Account Summary</span>
        <span className="text-xs text-orange-500 ml-auto">
          Gross value includes borrowed funds — net equity is what you'd keep after clearing the loan
        </span>
      </div>

      {/* Per-account breakdown */}
      <div className="space-y-3">
        {marginAccounts.map(acc => {
          const netEquity = acc.total_market_value_cad - acc.margin_loan_cad
          const annualInterest = acc.margin_loan_cad * acc.margin_rate_pct / 100
          return (
            <div key={acc.id} className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge type={acc.account_type} />
                  <span className="text-sm font-medium text-slate-200">{acc.name}</span>
                  <span className="text-xs text-slate-500">{acc.owner}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 text-xs">
                {/* Broker portfolio value — shown when stored; falls back to computed */}
                {acc.margin_portfolio_value_cad != null && acc.margin_portfolio_value_cad > 0 ? (
                  <div className="flex justify-between col-span-2 md:col-span-1">
                    <span className="text-slate-500">Portfolio value</span>
                    <span className="text-slate-200 font-medium">{fmt(acc.margin_portfolio_value_cad)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between col-span-2 md:col-span-1">
                    <span className="text-slate-500">Portfolio value <span className="text-slate-600">(computed)</span></span>
                    <span className="text-slate-200 font-medium">{fmt(acc.total_market_value_cad)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Margin used</span>
                  <span className="text-orange-300 font-medium">−{fmt(acc.margin_loan_cad)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-slate-400">Net equity</span>
                  <span className={netEquity >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmt(netEquity)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Interest rate</span>
                  <span className="text-slate-300">{acc.margin_rate_pct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Annual interest</span>
                  <span className="text-orange-300">−{fmt(annualInterest)}/yr</span>
                </div>
                {acc.margin_requirement_cad != null && acc.margin_requirement_cad > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Margin requirement</span>
                    <span className="text-slate-300">{fmt(acc.margin_requirement_cad)}</span>
                  </div>
                )}
                {acc.margin_buying_power_cad != null && acc.margin_buying_power_cad > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Max buying power</span>
                    <span className="text-slate-300">{fmt(acc.margin_buying_power_cad)}</span>
                  </div>
                )}
                {acc.margin_available_cad != null && acc.margin_available_cad > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Available to withdraw</span>
                    <span className="text-slate-300">{fmt(acc.margin_available_cad)}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Combined margin totals */}
      {marginAccounts.length > 1 && (
        <div className="mt-3 pt-3 border-t border-orange-800/40 grid grid-cols-3 gap-4 text-xs">
          <div>
            <div className="text-slate-500 mb-0.5">Total loan</div>
            <div className="text-orange-300 font-semibold">{fmt(totalLoan)}</div>
          </div>
          <div>
            <div className="text-slate-500 mb-0.5">Total net equity</div>
            <div className={`font-semibold ${totalNetEquity >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(totalNetEquity)}</div>
          </div>
          <div>
            <div className="text-slate-500 mb-0.5">Annual interest</div>
            <div className="text-orange-300 font-semibold">{fmt(totalInterest)}/yr</div>
          </div>
        </div>
      )}

      <div className="mt-2 text-xs text-slate-600">
        Update loan balance and broker figures in Holdings → ⚙ Edit Account.
      </div>
    </div>
  )
}

// ─── Person column ────────────────────────────────────────────────────────────

function PersonColumn({ owner, accts }: { owner: string; accts: Account[] }) {
  const gross     = accts.reduce((s, a) => s + a.total_market_value_cad, 0)
  const totalLoan = accts.reduce((s, a) => s + (a.margin_loan_cad || 0), 0)
  const net       = gross - totalLoan

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-slate-100">{OWNER_LABELS[owner] ?? owner}</h2>
        <div className="text-right">
          <div className="text-lg font-bold text-blue-300">{fmt(gross)}</div>
          {totalLoan > 0 && (
            <div className="text-xs text-orange-400">Net {fmt(net)} after margin</div>
          )}
        </div>
      </div>
      <div className="space-y-3 mt-3">
        {accts.map(acc => {
          const netEquity = acc.total_market_value_cad - acc.margin_loan_cad
          const hasLoan = acc.margin_loan_cad > 0
          return (
            <div key={acc.id} className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Badge type={acc.account_type} />
                <span className="text-sm text-slate-300 truncate max-w-[110px]" title={acc.name}>{acc.name}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-slate-100">{fmt(acc.total_market_value_cad)}</div>
                {hasLoan ? (
                  <div className="text-xs text-orange-400">Net {fmt(netEquity)}</div>
                ) : (
                  <div className={`text-xs ${acc.unrealized_gain_cad >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {acc.unrealized_gain_cad >= 0 ? '+' : ''}{fmt(acc.unrealized_gain_cad)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts })
  const { data: totals } = useQuery({ queryKey: ['totals'], queryFn: getPortfolioTotals })

  const combined        = totals?.combined ?? {}
  const totalMarket     = combined.total_market ?? 0
  const totalBook       = combined.total_book ?? 0
  const totalUnrealized = combined.total_unrealized ?? 0

  const totalMarginLoan     = accounts.reduce((s, a) => s + (a.margin_loan_cad || 0), 0)
  const totalMarginInterest = accounts.reduce((s, a) => s + ((a.margin_loan_cad || 0) * (a.margin_rate_pct || 0) / 100), 0)
  const netLiquidation      = totalMarket - totalMarginLoan

  const seanAccounts  = accounts.filter(a => a.owner === 'sean')
  const saudyaAccounts = accounts.filter(a => a.owner === 'saudya')
  const jointAccounts  = accounts.filter(a => a.owner === 'joint')

  const psnyWarning = accounts.some(a => a.unrealized_gain_cad < -5000)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Portfolio Overview</h1>
        <p className="text-slate-400 text-sm mt-1">Sean & Saudya Doyle — as of {new Date().toLocaleDateString('en-CA')}</p>
      </div>

      {/* Top stats — gross vs net side by side */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Gross value */}
        <div className="card">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Total Portfolio (Gross)</div>
          <div className="text-2xl font-semibold text-slate-100">{fmt(totalMarket)}</div>
          <div className="text-xs text-slate-500 mt-1">All holdings at market value</div>
        </div>

        {/* Net liquidation */}
        <div className="card border border-orange-800/40">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Net Liquidation Value</div>
          <div className="text-2xl font-semibold text-emerald-400">{fmt(netLiquidation)}</div>
          <div className="text-xs text-orange-400 mt-1">
            {totalMarginLoan > 0
              ? `After repaying ${fmt(totalMarginLoan)} margin`
              : 'No margin outstanding'}
          </div>
        </div>

        {/* Unrealized gains */}
        <div className="card">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Unrealized Gains</div>
          <div className={`text-2xl font-semibold ${totalUnrealized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(Math.abs(totalUnrealized))}
            <span className="ml-1 text-sm">{totalUnrealized >= 0 ? '▲' : '▼'}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Book value: {fmt(totalBook)}</div>
        </div>

        {/* Margin cost */}
        {totalMarginLoan > 0 ? (
          <div className="card">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Margin Borrowed</div>
            <div className="text-2xl font-semibold text-orange-400">{fmt(totalMarginLoan)}</div>
            <div className="text-xs text-slate-500 mt-1">{fmt(totalMarginInterest)}/yr interest</div>
          </div>
        ) : (
          <div className="card">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Unrealized (Saudya)</div>
            <div className="text-2xl font-semibold text-slate-100">{fmt(saudyaAccounts.reduce((s, a) => s + a.total_market_value_cad, 0))}</div>
            <div className="text-xs text-slate-500 mt-1">Excl. joint</div>
          </div>
        )}
      </div>

      {/* Margin exposure detail */}
      <MarginCard accounts={accounts} />

      {/* Loss alert */}
      {psnyWarning && (
        <div className="mb-6 bg-amber-900/30 border border-amber-700/50 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-amber-300 font-medium text-sm">Capital Loss Opportunity</div>
            <div className="text-amber-200/70 text-sm mt-0.5">
              PSNY (Polestar) in Sean's margin account has a significant unrealized loss.
              This can be used to offset capital gains and reduce your tax bill.{' '}
              <Link to="/acb" className="underline hover:text-amber-200">Review loss harvesting →</Link>
            </div>
          </div>
        </div>
      )}

      {/* Key reminders */}
      <div className="mb-6 bg-blue-900/20 border border-blue-700/30 rounded-xl p-4">
        <div className="text-blue-300 font-medium text-sm mb-2">📋 2026 Action Items</div>
        <ul className="text-sm text-blue-200/70 space-y-1">
          <li>• FHSA: <strong className="text-blue-200">$8,000 each</strong> remaining contribution room — must contribute before Dec 31</li>
          <li>• All other registered accounts already maxed for 2026</li>
          <li>• Saudya maternity leave planning: early 2027 — <Link to="/maternity" className="underline hover:text-blue-200">review impact</Link></li>
          <li>• PSNY loss harvesting: review before year-end to offset any 2026 gains</li>
        </ul>
      </div>

      {/* Per-person breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PersonColumn owner="sean"   accts={seanAccounts} />
        <PersonColumn owner="saudya" accts={saudyaAccounts} />
        <PersonColumn owner="joint"  accts={jointAccounts} />
      </div>

      {/* Quick links */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { to: '/tax',       label: '2026 Tax Calculator', icon: '📊' },
          { to: '/forecasts', label: 'Run Forecast',        icon: '📈' },
          { to: '/house',     label: 'House Planning',      icon: '🏠' },
          { to: '/ai',        label: 'Ask AI Advisor',      icon: '🤖' },
        ].map(({ to, label, icon }) => (
          <Link key={to} to={to}
            className="card hover:bg-slate-800 transition-colors text-center py-4 cursor-pointer">
            <div className="text-2xl mb-1">{icon}</div>
            <div className="text-sm text-slate-300">{label}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
