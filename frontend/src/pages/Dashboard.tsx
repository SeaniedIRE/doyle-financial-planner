import { useQuery } from '@tanstack/react-query'
import { getAccounts, getPortfolioTotals } from '../api/accounts'
import { fmt } from '../api/client'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import { TrendingUp, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'

const OWNER_LABELS: Record<string, string> = { sean: 'Sean', saudya: 'Saudya', joint: 'Joint' }

export default function Dashboard() {
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts })
  const { data: totals } = useQuery({ queryKey: ['totals'], queryFn: getPortfolioTotals })

  const combined = totals?.combined ?? {}
  const totalMarket = combined.total_market ?? 0
  const totalBook = combined.total_book ?? 0
  const totalUnrealized = combined.total_unrealized ?? 0

  const seanAccounts = accounts.filter(a => a.owner === 'sean')
  const saudyaAccounts = accounts.filter(a => a.owner === 'saudya')
  const jointAccounts = accounts.filter(a => a.owner === 'joint')

  const seanTotal = seanAccounts.reduce((s, a) => s + a.total_market_value_cad, 0)
  const saudyaTotal = saudyaAccounts.reduce((s, a) => s + a.total_market_value_cad, 0)
  const jointTotal = jointAccounts.reduce((s, a) => s + a.total_market_value_cad, 0)

  // Find positions with large losses (PSNY warning)
  const psnyWarning = accounts.some(a => a.unrealized_gain_cad < -5000)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Portfolio Overview</h1>
        <p className="text-slate-400 text-sm mt-1">Sean & Saudya Doyle — as of {new Date().toLocaleDateString('en-CA')}</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Portfolio" value={totalMarket} sub="All accounts combined" positive={false} negative={false} />
        <StatCard label="Unrealized Gains" value={totalUnrealized} sub={`Book value: ${fmt(totalBook)}`} />
        <StatCard label="Sean's Portfolio" value={seanTotal} sub="Excl. joint" positive={false} negative={false} />
        <StatCard label="Saudya's Portfolio" value={saudyaTotal} sub="Excl. joint" positive={false} negative={false} />
      </div>

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

      {/* Account breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {([
          { owner: 'sean', accts: seanAccounts, total: seanTotal },
          { owner: 'saudya', accts: saudyaAccounts, total: saudyaTotal },
          { owner: 'joint', accts: jointAccounts, total: jointTotal },
        ] as const).map(({ owner, accts, total }) => (
          <div key={owner} className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-100">{OWNER_LABELS[owner]}</h2>
              <span className="text-lg font-bold text-blue-300">{fmt(total)}</span>
            </div>
            <div className="space-y-3">
              {accts.map(acc => (
                <div key={acc.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge type={acc.account_type} />
                    <span className="text-sm text-slate-300 truncate max-w-[110px]" title={acc.name}>{acc.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-slate-100">{fmt(acc.total_market_value_cad)}</div>
                    <div className={`text-xs ${acc.unrealized_gain_cad >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {acc.unrealized_gain_cad >= 0 ? '+' : ''}{fmt(acc.unrealized_gain_cad)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { to: '/tax', label: '2026 Tax Calculator', icon: '📊' },
          { to: '/forecasts', label: 'Run Forecast', icon: '📈' },
          { to: '/house', label: 'House Planning', icon: '🏠' },
          { to: '/ai', label: 'Ask AI Advisor', icon: '🤖' },
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
