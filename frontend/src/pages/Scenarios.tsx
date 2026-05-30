import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getScenarios, createScenario, updateScenario, deleteScenario } from '../api/scenarios'
import { fmt } from '../api/client'
import { Plus, Edit2, Trash2, X, GitBranch } from 'lucide-react'
import type { Scenario } from '../types'
import { Link } from 'react-router-dom'

function ScenarioModal({ scenario, onClose }: { scenario: Scenario | null; onClose: () => void }) {
  const qc = useQueryClient()
  const isNew = !scenario?.id
  const [form, setForm] = useState<Partial<Scenario>>(scenario ?? {
    name: '',
    description: '',
    growth_conservative_pct: 5,
    growth_moderate_pct: 7,
    growth_optimistic_pct: 10,
    house_purchase_year: 2030,
    house_price_cad: 900000,
    house_down_payment_cad: 200000,
  })
  const mut = useMutation({
    mutationFn: () => isNew ? createScenario(form) : updateScenario(scenario!.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['scenarios'] }); onClose() },
  })
  const n = (label: string, key: keyof typeof form, type: 'number' | 'text' = 'number') => (
    <div>
      <label className="label">{label}</label>
      <input type={type} className="input" value={(form[key] as string | number) ?? ''}
        onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))} />
    </div>
  )
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg">
        <div className="flex justify-between mb-4">
          <h2 className="font-semibold text-slate-100">{isNew ? 'Create Scenario' : 'Edit Scenario'}</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          {n('Name', 'name', 'text')}
          <div><label className="label">Description</label>
            <textarea className="input h-20 resize-none" value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {n('Conservative %', 'growth_conservative_pct')}
            {n('Moderate %', 'growth_moderate_pct')}
            {n('Optimistic %', 'growth_optimistic_pct')}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {n('House Purchase Year', 'house_purchase_year')}
            {n('House Price', 'house_price_cad')}
            {n('Down Payment', 'house_down_payment_cad')}
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.name} className="btn-primary flex-1">
            {mut.isPending ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function Scenarios() {
  const qc = useQueryClient()
  const { data: scenarios = [] } = useQuery({ queryKey: ['scenarios'], queryFn: getScenarios })
  const [editing, setEditing] = useState<Scenario | null | 'new'>()
  const deleteMut = useMutation({
    mutationFn: deleteScenario,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios'] }),
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Scenarios</h1>
          <p className="text-slate-400 text-sm mt-1">Create different "what if" scenarios and compare them in Forecasts</p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Scenario
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {scenarios.map(s => (
          <div key={s.id} className={`card ${s.is_baseline ? 'border-blue-600/50' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <GitBranch size={16} className="text-blue-400 shrink-0" />
                <span className="font-semibold text-slate-100">{s.name}</span>
                {s.is_baseline && <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">Baseline</span>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(s)} className="p-1.5 text-slate-400 hover:text-blue-400"><Edit2 size={14} /></button>
                {!s.is_baseline && <button onClick={() => { if (confirm('Delete?')) deleteMut.mutate(s.id) }} className="p-1.5 text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>}
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-4">{s.description}</p>
            <div className="grid grid-cols-3 gap-2 text-xs mb-4">
              <div className="bg-amber-900/20 rounded-lg p-2 text-center">
                <div className="text-slate-500 mb-0.5">Conservative</div>
                <div className="text-amber-400 font-semibold">{s.growth_conservative_pct}%</div>
              </div>
              <div className="bg-blue-900/20 rounded-lg p-2 text-center">
                <div className="text-slate-500 mb-0.5">Moderate</div>
                <div className="text-blue-400 font-semibold">{s.growth_moderate_pct}%</div>
              </div>
              <div className="bg-emerald-900/20 rounded-lg p-2 text-center">
                <div className="text-slate-500 mb-0.5">Optimistic</div>
                <div className="text-emerald-400 font-semibold">{s.growth_optimistic_pct}%</div>
              </div>
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <div>🏠 House purchase: {s.house_purchase_year} @ {fmt(s.house_price_cad)} (down {fmt(s.house_down_payment_cad)})</div>
            </div>
            <Link to="/forecasts" className="btn-secondary mt-3 text-sm text-center block">
              Run Forecast →
            </Link>
          </div>
        ))}
      </div>

      {editing && (
        <ScenarioModal
          scenario={editing === 'new' ? null : editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  )
}
