import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPortfolioTotals, getSettings } from '../api/accounts'
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
  override_sean_cash?: number
  override_saudya_cash?: number
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

// ─── TFSA limits (matches backend tax_engine.py exactly) ─────────────────────

const TFSA_LIMITS: Record<number, number> = {
  2009: 5000, 2010: 5000, 2011: 5000, 2012: 5000,
  2013: 5500, 2014: 5500, 2015: 10000,
  2016: 5500, 2017: 5500, 2018: 5500,
  2019: 6000, 2020: 6000, 2021: 6000, 2022: 6000,
  2023: 6500, 2024: 7000, 2025: 7000, 2026: 7000,
}

function tfsaCumulativeRoom(canadaSince: number, year = 2026): number {
  let room = 0
  for (let y = Math.max(2009, canadaSince); y <= year; y++) {
    room += TFSA_LIMITS[y] ?? 7000
  }
  return room
}

// ─── Contribution limit helpers ───────────────────────────────────────────────

const FHSA_LIFETIME = 40_000
const FHSA_ANNUAL   = 8_000
const RRSP_CAP      = 32_490   // 2026 dollar cap

function fhsaLifetimeRemaining(contributed: number) {
  return Math.max(0, FHSA_LIFETIME - contributed)
}

function fhsaAnnualRemaining(contributed: number, openYear: number, currentYear = 2026) {
  const yearsOpen = Math.max(0, currentYear - openYear + 1)
  const maxRoom   = Math.min(FHSA_LIFETIME, yearsOpen * FHSA_ANNUAL)
  return Math.max(0, maxRoom - contributed)
}

// ─── FHSA limit badge ─────────────────────────────────────────────────────────

function FHSABadge({ contributed, openYear }: { contributed: number; openYear: number }) {
  const pct       = Math.min(100, (contributed / FHSA_LIFETIME) * 100)
  const maxed     = contributed >= FHSA_LIFETIME
  const nearMaxed = pct >= 80
  const annualRoom = fhsaAnnualRemaining(contributed, openYear)

  return (
    <div className={`text-xs rounded-lg px-2 py-1 border ${
      maxed     ? 'bg-red-900/30 border-red-700/50 text-red-300' :
      nearMaxed ? 'bg-amber-900/30 border-amber-700/50 text-amber-300' :
                  'bg-slate-800/60 border-slate-700/40 text-slate-400'
    }`}>
      {maxed ? '⛔ Lifetime max reached — no more FHSA contributions' : (
        <>
          Lifetime: {fmt(contributed)} / {fmt(FHSA_LIFETIME)}
          {nearMaxed && ' ⚠ near limit'}
          <span className="mx-1 opacity-40">·</span>
          {fmt(annualRoom)} room now
        </>
      )}
    </div>
  )
}

// ─── Account row (adjustable) ─────────────────────────────────────────────────

function AccountRow({
  label, current, delta, onDelta, badge, note,
}: {
  label: string
  current: number
  delta: string
  onDelta: (v: string) => void
  badge?: React.ReactNode
  note?: string
}) {
  const deltaNum  = parseFloat(delta) || 0
  const projected = current + deltaNum

  return (
    <div className="py-3 border-b border-slate-800 last:border-0">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-200">{label}</div>
          {badge && <div className="mt-1">{badge}</div>}
          {note && <div className="text-xs text-slate-600 mt-0.5">{note}</div>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-slate-500">Current</div>
          <div className="text-sm font-medium text-slate-300">{fmt(current)}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">+$</span>
          <input
            type="number"
            className="input pl-8 text-sm h-9"
            placeholder="0  (add or subtract)"
            value={delta}
            onChange={e => onDelta(e.target.value)}
          />
        </div>
        <div className={`text-sm font-semibold text-right w-28 shrink-0 ${
          deltaNum > 0 ? 'text-emerald-400' : deltaNum < 0 ? 'text-red-400' : 'text-slate-600'
        }`}>
          {deltaNum !== 0 ? fmt(projected) : <span className="text-slate-700">unchanged</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Info row (read-only balance, no simulation override) ─────────────────────

function InfoRow({ label, current, note }: { label: string; current: number; note?: string }) {
  return (
    <div className="py-3 border-b border-slate-800 last:border-0 flex items-center justify-between">
      <div>
        <div className="text-sm font-medium text-slate-400">{label}</div>
        {note && <div className="text-xs text-slate-600 mt-0.5">{note}</div>}
      </div>
      <div className="text-sm text-slate-400">{fmt(current)}</div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WhatIf() {
  const qc = useQueryClient()

  const { data: totals   } = useQuery({ queryKey: ['totals'],   queryFn: getPortfolioTotals })
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings })

  const [scenarioName, setScenarioName] = useState('My What-If')
  const [description,  setDescription ] = useState('')
  const [shouldSave,   setShouldSave  ] = useState(false)
  const [result,       setResult      ] = useState<YearResult[] | null>(null)

  const emptyDeltas = () => ({ tfsa: '', rrsp: '', fhsa: '', margin: '', cash: '', base: '' })
  const [seanD,   setSeanD  ] = useState(emptyDeltas())
  const [saudyaD, setSaudyaD] = useState(emptyDeltas())
  const [houseYear, setHouseYear] = useState('')
  const [houseDown, setHouseDown] = useState('')

  // ── Current balances from portfolio totals ────────────────────────────────
  const bal = useMemo(() => {
    const g = (owner: string, type: string): number =>
      (totals?.[owner]?.[type]?.market_value_cad ?? 0) as number
    return {
      sean: {
        tfsa: g('sean','TFSA'), rrsp: g('sean','RRSP'),
        fhsa: g('sean','FHSA'), margin: g('sean','Margin'),
        cash: g('sean','Cash'),
      },
      saudya: {
        tfsa: g('saudya','TFSA'), rrsp: g('saudya','RRSP'),
        fhsa: g('saudya','FHSA'), margin: g('saudya','Margin'),
        cash: g('saudya','Cash'), lira: g('saudya','LIRA'),
      },
    }
  }, [totals])

  // ── Settings-derived values ───────────────────────────────────────────────
  const canadaSinceSean   = parseInt(settings?.sean_canada_since   ?? '2015') || 2015
  const canadaSinceSaudya = parseInt(settings?.saudya_canada_since ?? '2015') || 2015
  const fhsaContribSean   = parseFloat(settings?.fhsa_contributed_sean   ?? '0') || 0
  const fhsaContribSaudya = parseFloat(settings?.fhsa_contributed_saudya ?? '0') || 0
  const fhsaOpenSean      = parseInt(settings?.fhsa_opened_year_sean     ?? '2023') || 2023
  const fhsaOpenSaudya    = parseInt(settings?.fhsa_opened_year_saudya   ?? '2023') || 2023

  const tfsaRoomSean   = tfsaCumulativeRoom(canadaSinceSean)
  const tfsaRoomSaudya = tfsaCumulativeRoom(canadaSinceSaudya)

  // ── Simulation request ────────────────────────────────────────────────────
  function buildRequest(): WhatIfRequest {
    const req: WhatIfRequest = {
      name: scenarioName,
      description: description || undefined,
      save: shouldSave,
    }
    const applyDelta = (key: keyof WhatIfRequest, current: number, deltaStr: string) => {
      const d = parseFloat(deltaStr)
      if (!isNaN(d) && d !== 0)
        (req as unknown as Record<string, unknown>)[key] = current + d
    }
    applyDelta('override_sean_tfsa',     bal.sean.tfsa,     seanD.tfsa)
    applyDelta('override_sean_rrsp',     bal.sean.rrsp,     seanD.rrsp)
    applyDelta('override_sean_fhsa',     bal.sean.fhsa,     seanD.fhsa)
    applyDelta('override_sean_margin',   bal.sean.margin,   seanD.margin)
    applyDelta('override_sean_cash',     bal.sean.cash,     seanD.cash)
    applyDelta('override_saudya_tfsa',   bal.saudya.tfsa,   saudyaD.tfsa)
    applyDelta('override_saudya_rrsp',   bal.saudya.rrsp,   saudyaD.rrsp)
    applyDelta('override_saudya_fhsa',   bal.saudya.fhsa,   saudyaD.fhsa)
    applyDelta('override_saudya_margin', bal.saudya.margin, saudyaD.margin)
    applyDelta('override_saudya_cash',   bal.saudya.cash,   saudyaD.cash)
    if (seanD.base)   req.override_sean_base   = parseFloat(seanD.base)
    if (saudyaD.base) req.override_saudya_base = parseFloat(saudyaD.base)
    if (houseYear)    req.override_house_purchase_year = parseInt(houseYear)
    if (houseDown)    req.override_house_down_payment  = parseFloat(houseDown)
    return req
  }

  const simulate = useMutation({
    mutationFn: (req: WhatIfRequest) =>
      api.post<{ result: YearResult[] }>('/whatif/simulate', req),
    onSuccess: res => {
      setResult(res.data.result)
      if (shouldSave) qc.invalidateQueries({ queryKey: ['whatif-saved'] })
    },
  })

  const { data: saved } = useQuery({
    queryKey: ['whatif-saved'],
    queryFn: () =>
      api.get<{ id: number; name: string; description?: string; created_at: string }[]>('/whatif/')
        .then(r => r.data),
  })
  const deleteSim = useMutation({
    mutationFn: (id: number) => api.delete(`/whatif/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whatif-saved'] }),
  })

  const chartData  = result?.map(r => ({
    year: r.year,
    Conservative: Math.round(r.combined_net_worth.conservative),
    Moderate:     Math.round(r.combined_net_worth.moderate),
    Optimistic:   Math.round(r.combined_net_worth.optimistic),
  }))
  const lastResult = result?.[result.length - 1]

  const anyDelta = [
    seanD.tfsa, seanD.rrsp, seanD.fhsa, seanD.margin, seanD.cash, seanD.base,
    saudyaD.tfsa, saudyaD.rrsp, saudyaD.fhsa, saudyaD.margin, saudyaD.cash, saudyaD.base,
    houseYear, houseDown,
  ].some(v => v !== '' && parseFloat(v || '0') !== 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">What-If Simulator</h1>
      <p className="text-slate-400 text-sm mb-6">
        Start from today's balances and adjust any account by a delta (+/−) to model a scenario.
        Leave all deltas at 0 to run a straight baseline projection.
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
          <h2 className="font-semibold text-slate-200 mb-0.5">Sean</h2>
          <p className="text-xs text-slate-500 mb-3">
            Enter +/− delta. Simulation starts from Current + Delta for adjustable accounts.
          </p>

          <AccountRow label="TFSA" current={bal.sean.tfsa} delta={seanD.tfsa} onDelta={v => setSeanD(d => ({ ...d, tfsa: v }))}
            badge={
              <div className="text-xs text-slate-500">
                Cumulative room since {canadaSinceSean}: <strong className="text-slate-400">{fmt(tfsaRoomSean)}</strong>
                <span className="ml-1 opacity-60">· +$7,000/yr</span>
                <div className="text-slate-600 mt-0.5">Actual remaining = cumulative − net contributions · verify at CRA My Account</div>
              </div>
            }
          />
          <AccountRow label="RRSP" current={bal.sean.rrsp} delta={seanD.rrsp} onDelta={v => setSeanD(d => ({ ...d, rrsp: v }))}
            note={`Annual cap: ${fmt(RRSP_CAP)} or 18% of prior year income, whichever is less`}
          />
          <AccountRow label="FHSA" current={bal.sean.fhsa} delta={seanD.fhsa} onDelta={v => setSeanD(d => ({ ...d, fhsa: v }))}
            badge={<FHSABadge contributed={fhsaContribSean} openYear={fhsaOpenSean} />}
            note={fhsaContribSean < FHSA_LIFETIME ? `${fmt(fhsaLifetimeRemaining(fhsaContribSean))} lifetime room left` : undefined}
          />
          <AccountRow label="Margin" current={bal.sean.margin} delta={seanD.margin} onDelta={v => setSeanD(d => ({ ...d, margin: v }))}
            note="No contribution limit — borrowed or self-funded"
          />
          <AccountRow label="Cash (non-reg)" current={bal.sean.cash} delta={seanD.cash} onDelta={v => setSeanD(d => ({ ...d, cash: v }))}
            note="No contribution limit — taxable non-registered account"
          />

          <div className="pt-3 mt-1">
            <label className="label text-xs">Base salary override (absolute, leave blank to use current)</label>
            <input className="input text-sm h-9" placeholder="e.g. 340000" value={seanD.base} onChange={e => setSeanD(d => ({ ...d, base: e.target.value }))} />
          </div>
        </div>

        {/* ── Saudya ── */}
        <div className="card">
          <h2 className="font-semibold text-slate-200 mb-0.5">Saudya</h2>
          <p className="text-xs text-slate-500 mb-3">
            Enter +/− delta. Simulation starts from Current + Delta for adjustable accounts.
          </p>

          <AccountRow label="TFSA" current={bal.saudya.tfsa} delta={saudyaD.tfsa} onDelta={v => setSaudyaD(d => ({ ...d, tfsa: v }))}
            badge={
              <div className="text-xs text-slate-500">
                Cumulative room since {canadaSinceSaudya}: <strong className="text-slate-400">{fmt(tfsaRoomSaudya)}</strong>
                <span className="ml-1 opacity-60">· +$7,000/yr</span>
                <div className="text-slate-600 mt-0.5">Actual remaining = cumulative − net contributions · verify at CRA My Account</div>
              </div>
            }
          />
          <AccountRow label="RRSP" current={bal.saudya.rrsp} delta={saudyaD.rrsp} onDelta={v => setSaudyaD(d => ({ ...d, rrsp: v }))}
            note={`Annual cap: ${fmt(RRSP_CAP)} or 18% of prior year income, whichever is less`}
          />
          <AccountRow label="FHSA" current={bal.saudya.fhsa} delta={saudyaD.fhsa} onDelta={v => setSaudyaD(d => ({ ...d, fhsa: v }))}
            badge={<FHSABadge contributed={fhsaContribSaudya} openYear={fhsaOpenSaudya} />}
            note={fhsaContribSaudya < FHSA_LIFETIME ? `${fmt(fhsaLifetimeRemaining(fhsaContribSaudya))} lifetime room left` : undefined}
          />
          <AccountRow label="Margin" current={bal.saudya.margin} delta={saudyaD.margin} onDelta={v => setSaudyaD(d => ({ ...d, margin: v }))}
            note="No contribution limit — borrowed or self-funded"
          />
          <AccountRow label="Cash (non-reg)" current={bal.saudya.cash} delta={saudyaD.cash} onDelta={v => setSaudyaD(d => ({ ...d, cash: v }))}
            note="No contribution limit — taxable non-registered account"
          />
          <InfoRow label="LIRA" current={bal.saudya.lira} note="Locked-in from prior employer pension — cannot contribute further" />

          <div className="pt-3 mt-1">
            <label className="label text-xs">Base salary override (absolute, leave blank to use current)</label>
            <input className="input text-sm h-9" placeholder="e.g. 115000" value={saudyaD.base} onChange={e => setSaudyaD(d => ({ ...d, base: e.target.value }))} />
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
          <span className="text-xs text-slate-600">No deltas set — projects current balances as-is</span>
        )}
        {simulate.isError && (
          <span className="text-red-400 text-sm">Simulation failed — check the container log.</span>
        )}
      </div>

      {/* Chart */}
      {result && chartData && lastResult && (
        <div className="card mb-6">
          <h2 className="font-semibold text-slate-200 mb-1">Combined Net Worth — 2026 to 2065</h2>
          {anyDelta && (
            <p className="text-xs text-slate-500 mb-4">{scenarioName}{description ? ` — ${description}` : ''}</p>
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
          <div className="text-xs text-slate-600 mt-3">Conservative = 5% growth · Moderate = 7% · Optimistic = 10%</div>
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
