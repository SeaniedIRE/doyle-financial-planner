import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Wallet, Calculator, TrendingUp, DollarSign,
  GitBranch, Home, Baby, Bot, Settings, ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/holdings', icon: Wallet, label: 'Holdings & Accounts' },
  { to: '/acb', icon: Calculator, label: 'ACB Tracker' },
  { to: '/tax', icon: DollarSign, label: 'Tax Planning' },
  { to: '/income', icon: TrendingUp, label: 'Income' },
  { to: '/scenarios', icon: GitBranch, label: 'Scenarios' },
  { to: '/forecasts', icon: TrendingUp, label: 'Forecasts' },
  { to: '/house', icon: Home, label: 'House Planning' },
  { to: '/maternity', icon: Baby, label: 'Maternity Leave' },
  { to: '/ai', icon: Bot, label: 'AI Advisor' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  return (
    <aside className="w-60 min-h-screen bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
      <div className="px-5 py-6 border-b border-slate-800">
        <div className="text-blue-400 font-bold text-lg leading-tight">Doyle</div>
        <div className="text-slate-400 text-xs mt-0.5">Financial Planner</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors group',
                isActive
                  ? 'bg-blue-600/20 text-blue-300 font-medium'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800',
              )
            }
          >
            <Icon size={16} className="shrink-0" />
            <span className="flex-1">{label}</span>
            <ChevronRight size={12} className="opacity-0 group-hover:opacity-50 transition-opacity" />
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-slate-800 text-xs text-slate-600">
        Data as of {new Date().toLocaleDateString('en-CA')}
      </div>
    </aside>
  )
}
