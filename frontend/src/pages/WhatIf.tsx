import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAccounts, getPortfolioTotals, getSettings } from '../api/accounts'
import api from '../api/client'
import { fmt } from '../api/client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WhatIfRequest {
  name: string
  description?: string
  override_sean_tfsa?: number
  override_saudya_tfsa?: number
  override_sean_rrsp?: number
  override_saudya_rrsp?: number
  override_sean_fhsa?: number
  override_saudya_fhsa?: number
  override_sean_margin?: number
  override_saudya_margin?: number
  override_sean_base?: number
  override_saudya_base?: number
  override_house_purchase_year?: number
  override_house_down_payment?: number
  save?: boolean
}

interface YearResult {
  year: number
  combined_net_worth: { conservative: number; moderate: number; optimistic: number }
  events: string[]
}

// ─── Contribution limit helpers ───────────────────────────────────────────────

const FHSA_LIFETIME = 40_000
const FHSA_ANNUAL   = 8_000
const TFSA_ANNUAL   = 7_000      // 2026
const RRSP_CAP      = 32_490     // 2026 dollar cap (18% of income up to this)

function fhsaLifetimeRemaining(contributed: number) {
  return Math.max(0, FHSA_LIFETIME - contributed)
}

function fhsaAnnualRemaining(contributed: number, openYear: number, currentYear = 2026) {
  // Room = $8k × years since open, max $40k total, minus what's already contributed
  const yearsOpen = Math.max(0, currentYear - openYear + 1)
  const maxRoom   = Math.min(FHSA_LIFETIME, yearsOpen * FHSA_ANNUAL)
  return Math.max(0, maxRoom - contributed)
}

// ─── Limit badge ─────────────────────────────────────────────────────────────

function LimitBadge({ label, used, cap, annual }: {
  label: string; used: number; cap?: number; annual?: number
}) {
  const pct      = cap ? Math.min(100, (used / cap) * 100) : null
  const nearFull = pct !== null && pct >= 90
  const full     = pct !== null && pct >= 100

  return (
    <div className={`text-xs rounded-lg px-2 py-1 border ${
      full     ? 'bg-red-900/30 border-red-700/50 text-red-300' :
      nearFull ? 'bg-amber-900/30 border-amber-700/50 text-amber-300' :
                 'bg-slate-800/60 border-slate-700/40 text-slate-400'
    }`}>
      {full ? '⛔ ' : nearFull ? '⚠ ' : ''}
      {label}
      {annual !== undefined && <span className="ml-1 opacity-70">+{fmt(annual)}/yr</span>}
      {cap !== undefined && (
        <span className="ml-1">
          {fmt(used)} / {fmt(cap)}
          {full ? ' — MAXED' : nearFull ? ' — almost full' : ''}
        </span>
      )}
    </div>
  )
}

// ─── Account row ──────────────────────────────────────────────────────────────

function AccountRow({
  label, current, delta, onDelta, limitBadge, note,
}: {
  label: string
  current: number
  delta: string
  onDelta: (v: string) => void
  limitBadge?: React.ReactNode
  note?: string
}) {
  const deltaNum  = parseFloat(delta) || 0
  const projected = current + deltaNum

  return (
    <div className="grid grid-cols-12 gap-3 items-center py-3 border-b border-slate-800 last:border-0">
      {/* Label + badge */}
      <div className="col-span-12 md:col-span-4">
        <div className="text-sm font-medium text-slate-200">{label}</div>
        {limitBadge && <div className="mt-1">{limitBadge}</div>}
        {note && <div className="text-xs text-slate-600 mt-0.5">{note}</div>}
      </div>

      {/* Current balance */}
      <div className="col-span-4 md:col-span-2 text-right">
        <div className="text-xs text-slate-500 mb-0.5">Current</div>
        <div className="text-sm text-slate-300 font-medium">{fmt(current)}</div>
      </div>

      {/* Delta input */}
      <div className="col-span-8 md:col-span-3">
        <div className="text-xs text-slate-500 mb-0.5">Add / Remove</div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">+$</span>
          <input
            type="number"
            className="input pl-8 text-sm"
            placeholder="0"
            value={delta}
            onChange={e => onDelta(e.target.value)}
          />
        </div>
      </div>

      {/* Projected */}
      <div className="col-span-12 md:col-span-3 text-right">
        <div className="text-xs text-slate-500 mb-0.5">Projected start</div>
        <div className={`text-sm font-semibold ${deltaNum > 0 ? 'text-emerald-400' : deltaNum < 0 ? 'text-red-400' : 'text-slate-400'}`}>
          {fmt(projected)}
          {deltaNum !== 0 && (
            <span className="ml-1 text-xs font-normal opacity-70">
              ({deltaNum > 0 ? '+' : ''}{fmt(deltaNum)})
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WhatIf() {
  const qc = useQueryClient()

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: totals    } = useQuery({ queryKey: ['totals'],    queryFn: getPortfolioTotals })
  const { data: settings  } = useQuery({ queryKey: ['settings'],  queryFn: getSettings })

  // ── Scenario state ────────────────────────────────────────────────────────
  const [scenarioName, setScenarioName] = useState('My What-If')
  const [description,  setDescription ] = useState('')
  const [shouldSave,   setShouldSave  ] = useState(false)
  const [result,       setResult      ] = useState<YearResult[] | null>(null)

  // Per-person account deltas (string so empty input works cleanly)
  const emptyDeltas = () => ({
    tfsa: '', rrsp: '', fhsa: '', margin: '', base: ''
  })
  const [seanDeltas,  setSeanDeltas ] = useState(emptyDeltas())
  const [saudyaDeltas,setSaudyaDeltas] = useState(emptyDeltas())
  const [houseYear,   setHouseYear  ] = useState('')
  const [houseDown,   setHouseDown  ] = useState('')

  // ── Derived current balances ───────────────────────────────────────────────
  const bal = useMemo(() => {
    const t = totals ?? {}
    const g = (owner: string, type: string) =>
      (t[owner]?.[type]?.market_value_cad ?? 0) as number
    return {
      sean:  { tfsa: g('sean','TFSA'), rrsp: g('sean','RRSP'), fhsa: g('sean','FHSA'), margin: g('sean','Margin') },
      saudya:{ tfsa: g('saudya','TFSA'), rrsp: g('saudya','RRSP'), fhsa: g('saudya','FHSA'), margin: g('saudya','Margin') },
    }
  }, [totals])

  // ── FHSA tracking from settings ──────────────────────────────────────────
  const fhsaContribSean   = parseFloat(settings?.fhsa_contributed_sean   ?? '0') || 0
  const fhsaContribSaudya = parseFloat(settings?.fhsa_contributed_saudya ?? '0') || 0
  const fhsaOpenSean      = parseInt(settings?.fhsa_opened_year_sean     ?? '2023') || 2023
  const fhsaOpenSaudya    = parseInt(settings?.fhsa_opened_year_saudya   ?? '2023') || 2023

  // ── TFSA room (cumulative room minus current balance) ─────────────────────
  const canadaSinceSean   = parseInt(settings?.sean_canada_since   ?? '2015') || 2015
  const canadaSinceSaudya = parseInt(settings?.saudya_canada_since ?? '2015') || 2015
  // Rough cumulative room from 2009 at $7k/yr, adjusted for year resident
  function tfsaCumulativeRoom(canadaSince: number, year = 2026): number {
    const ANNUAL = [5000,5000,5000,5500,5500,5500,5500,6000,6000,6000,6000,6000,6000,6000,6500,6500,7000,7000]
    let room = 0
    for (let y = 2009; y <= year; y++) {
      if (y >= canadaSince) room += ANNUAL[y - 2009] ?? 7000
    }
    return room
  }
  const tfsaRoomSean   = Math.max(0, tfsaCumulativeRoom(canadaSinceSean)   - bal.sean.tfsa)
  const tfsaRoomSaudya = Math.max(0, tfsaCumulativeRoom(canadaSinceSaudya) - bal.saudya.tfsa)

  // ── Build simulation request ──────────────────────────────────────────────
  function buildRequest(): WhatIfRequest {
    const req: WhatIfRequest = { name: scenarioName, description: description || undefined, save: shouldSave }

    const applyDelta = (key: keyof WhatIfRequest, current: number, deltaStr: string) => {
      const d = parseFloat(deltaStr)
      if (!isNaN(d) && d !== 0) (req as unknown as Record<string, unknown>)[key] = current + d
    }

    applyDelta('override_sean_tfsa',   bal.sean.tfsa,    seanDeltas.tfsa)
    applyDelta('override_sean_rrsp',   bal.sean.rrsp,    seanDeltas.rrsp)
    applyDelta('override_sean_fhsa',   bal.sean.fhsa,    seanDeltas.fhsa)
    applyDelta('override_sean_margin', bal.sean.margin,  seanDeltas.margin)
    applyDelta('override_saudya_tfsa',   bal.saudya.tfsa,   saudyaDeltas.tfsa)
    applyDelta('override_saudya_rrsp',   bal.saudya.rrsp,   saudyaDeltas.rrsp)
    applyDelta('override_saudya_fhsa',   bal.saudya.fhsa,   saudyaDeltas.fhsa)
    applyDelta('override_saudya_margin', bal.saudya.margin, saudyaDeltas.margin)

    if (seanDeltas.base)   req.override_sean_base   = parseFloat(seanDeltas.base)
    if (saudyaDeltas.base) req.override_saudya_base = parseFloat(saudyaDeltas.base)
    if (houseYear) req.override_house_purchase_year = parseInt(houseYear)
    if (houseDown) req.override_house_down_payment  = parseFloat(houseDown)

    return req
  }

  const simulate = useMutation({
    mutationFn: (req: WhatIfRequest) => api.post<{ result: YearResult[] }>('/whatif/simulate', req),
    onSuccess: res => {
      setResult(res.data.result)
      if (shouldSave) qc.invalidateQueries({ queryKey: ['whatif-saved'] })
    },
  })

  const { data: saved } = useQuery({
    queryKey: ['whatif-saved'],
    queryFn: () => api.get<{ id: number; name: string; description?: string; created_at: string }[]>('/whatif/').then(r => r.data),
  })
  const deleteSim = useMutation({
    mutationFn: (id: number) => api.delete(`/whatif/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whatif-saved'] }),
  })

  const chartData = result?.map(r => ({
    year: r.year,
    Conservative: Math.round(r.combined_net_worth.conservative),
    Moderate:     Math.round(r.combined_net_worth.moderate),
    Optimistic:   Math.round(r.combined_net_worth.optimistic),
  }))
  const lastResult = result?.[result.length - 1]

  const anyDelta = [
    ...Object.values(seanDeltas), ...Object.values(saudyaDeltas), houseYear, houseDown
  ].some(v => v !== '' && v !== '0' && parseFloat(v || '0') !== 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">What-If Simulator</h1>
      <p className="text-slate-400 text-sm mb-6">
        Start from current balances, adjust any account by a delta, and see the 40-year impact.
        Leave deltas at 0 to run a baseline projection.
      </p>

      {/* Scenario name */}
      <div className="card mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Scenario name</label>
            <input className="input" value={scenarioName} onChange={e => setScenarioName(e.target.value)} />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <input className="input" placeholder="e.g. What if we add $50k to the TFSA?" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Person columns */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">

        {/* ── Sean ── */}
        <div className="card">
          <h2 className="font-semibold text-slate-200 mb-1">Sean</h2>
          <p className="text-xs text-slate-500 mb-3">Enter a positive amount to add, negative to remove. Projection starts from Current + Delta.</p>

          <AccountRow
            label="TFSA"
            current={bal.sean.tfsa}
            delta={seanDeltas.tfsa}
            onDelta={v => setSeanDeltas(d => ({ ...d, tfsa: v }))}
            limitBadge={
              tfsaRoomSean <= 0
                ? <LimitBadge label="TFSA annual room" used={bal.sean.tfsa} cap={tfsaCumulativeRoom(canadaSinceSean)} annual={TFSA_ANNUAL} />
                : <span className="text-xs text-slate-500">{fmt(tfsaRoomSean)} room remaining · +{fmt(TFSA_ANNUAL)}/yr</span>
            }
          />
          <AccountRow
            label="RRSP"
            current={bal.sean.rrsp}
            delta={seanDeltas.rrsp}
            onDelta={v => setSeanDeltas(d => ({ ...d, rrsp: v }))}
            note={`Annual cap: ${fmt(RRSP_CAP)} (or 18% of prior year income)`}
          />
          <AccountRow
            label="FHSA"
            current={bal.sean.fhsa}
            delta={seanDeltas.fhsa}
            onDelta={v => setSeanDeltas(d => ({ ...d, fhsa: v }))}
            limitBadge={
              <LimitBadge
                label="Lifetime"
                used={fhsaContribSean}
                cap={FHSA_LIFETIME}
                annual={fhsaContribSean < FHSA_LIFETIME ? fhsaAnnualRemaining(fhsaContribSean, fhsaOpenSean) : undefined}
              />
            }
            note={fhsaContribSean >= FHSA_LIFETIME ? undefined : `${fmt(fhsaLifetimeRemaining(fhsaContribSean))} lifetime room left`}
          />
          <AccountRow
            label="Margin"
            current={bal.sean.margin}
            delta={seanDeltas.margin}
            onDelta={v => setSeanDeltas(d => ({ ...d, margin: v }))}
            note="No contribution limit — borrowed or self-funded"
          />
          <div className="pt-3 border-t border-slate-800 mt-1">
            <div className="text-xs text-slate-500 mb-1">Base salary override (leave blank to use current)</div>
            <input className="input text-sm" placeholder="e.g. 340000" value={seanDeltas.base} onChange={e => setSeanDeltas(d => ({ ...d, base: e.target.value }))} />
          </div>
        </div>

        {/* ── Saudya ── */}
        <div className="card">
          <h2 className="font-semibold text-slate-200 mb-1">Saudya</h2>
          <p className="text-xs text-slate-500 mb-3">Enter a positive amount to add, negative to remove. Projection starts from Current + Delta.</p>

          <AccountRow
            label="TFSA"
            current={bal.saudya.tfsa}
            delta={saudyaDeltas.tfsa}
            onDelta={v => setSaudyaDeltas(d => ({ ...d, tfsa: v }))}
            limitBadge={
              tfsaRoomSaudya <= 0
                ? <LimitBadge label="TFSA annual room" used={bal.saudya.tfsa} cap={tfsaCumulativeRoom(canadaSinceSaudya)} annual={TFSA_ANNUAL} />
                : <span className="text-xs text-slate-500">{fmt(tfsaRoomSaudya)} room remaining · +{fmt(TFSA_ANNUAL)}/yr</span>
            }
          />
          <AccountRow
            label="RRSP"
            current={bal.saudya.rrsp}
            delta={saudyaDeltas.rrsp}
            onDelta={v => setSaudyaDeltas(d => ({ ...d, rrsp: v }))}
            note={`Annual cap: ${fmt(RRSP_CAP)} (or 18% of prior year income)`}
          />
          <AccountRow
            label="FHSA"
            current={bal.saudya.fhsa}
            delta={saudyaDeltas.fhsa}
            onDelta={v => setSaudyaDeltas(d => ({ ...d, fhsa: v }))}
            limitBadge={
              <LimitBadge
                label="Lifetime"
                used={fhsaContribSaudya}
                cap={FHSA_LIFETIME}
                annual={fhsaContribSaudya < FHSA_LIFETIME ? fhsaAnnualRemaining(fhsaContribSaudya, fhsaOpenSaudya) : undefined}
              />
            }
            note={fhsaContribSaudya >= FHSA_LIFETIME ? undefined : `${fmt(fhsaLifetimeRemaining(fhsaContribSaudya))} lifetime room left`}
          />
          <AccountRow
            label="Margin"
            current={bal.saudya.margin}
            delta={saudyaDeltas.margin}
            onDelta={v => setSaudyaDeltas(d => ({ ...d, margin: v }))}
            note="No contribution limit — borrowed or self-funded"
          />
          <div className="pt-3 border-t border-slate-800 mt-1">
            <div className="text-xs text-slate-500 mb-1">Base salary override (leave blank to use current)</div>
            <input className="input text-sm" placeholder="e.g. 115000" value={saudyaDeltas.base} onChange={e => setSaudyaDeltas(d => ({ ...d, base: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* House planning */}
      <div className="card mb-4">
        <h2 className="font-semibold text-slate-200 mb-3">House Purchase (optional)</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Purchase Year</label>
            <input className="input" placeholder="e.g. 2029" value={houseYear} onChange={e => setHouseYear(e.target.value)} />
          </div>
          <div>
            <label className="label">Down Payment ($)</label>
            <input className="input" placeholder="e.g. 250000" value={houseDown} onChange={e => setHouseDown(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Run */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => simulate.mutate(buildRequest())}
          disabled={simulate.isPending}
          className="btn-primary"
        >
          {simulate.isPending ? 'Running…' : anyDelta ? 'Run What-If' : 'Run Baseline'}
        </button>
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
          <input type="checkbox" checked={shouldSave} onChange={e => setShouldSave(e.target.checked)} className="rounded accent-blue-500" />
          Save this scenario
        </label>
        {!anyDelta && (
          <span className="text-xs text-slate-600">No deltas set — will project current balances as-is</span>
        )}
        {simulate.isError && (
          <span className="text-red-400 text-sm">Simulation failed — check the log.</span>
        )}
      </div>

      {/* Chart */}
      {result && chartData && lastResult && (
        <div className="card mb-6">
          <h2 className="font-semibold text-slate-200 mb-1">Combined Net Worth — 2026 to 2065</h2>
          {anyDelta && (
            <p className="text-xs text-slate-500 mb-4">Scenario: {scenarioName}{description ? ` — ${description}` : ''}</p>
          )}
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tickFormatter={(v: number) => `$${(v / 1_000_000).toFixed(1)}M`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                formatter={(v: number) => fmt(v)}
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Line type="monotone" dataKey="Conservative" stroke="#64748b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Moderate"     stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Optimistic"   stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-4 mt-4">
            {(['conservative', 'moderate', 'optimistic'] as const).map(s => (
              <div key={s} className="bg-slate-800/50 rounded-lg p-3 text-center">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1 capitalize">{s} (2065)</div>
                <div className="text-lg font-bold text-slate-100">{fmt(lastResult.combined_net_worth[s])}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-600 mt-3">Conservative = 5% annual growth · Moderate = 7% · Optimistic = 10%</div>
        </div>
      )}

      {/* Saved scenarios */}
      {saved && saved.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-slate-200 mb-3">Saved Scenarios</h2>
          <div className="space-y-2">
            {saved.map(sim => (
              <div key={sim.id} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg">
                <div>
                  <div className="font-medium text-sm text-slate-200">{sim.name}</div>
                  {sim.description && <div className="text-xs text-slate-500">{sim.description}</div>}
                  <div className="text-xs text-slate-600 mt-0.5">{new Date(sim.created_at).toLocaleDateString('en-CA')}</div>
                </div>
                <button onClick={() => deleteSim.mutate(sim.id)} className="text-red-500 hover:text-red-400 text-xs transition-colors">
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
