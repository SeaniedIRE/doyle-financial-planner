import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getIncome, createIncome, updateIncome, deleteIncome } from '../api/tax'
import { fmt } from '../api/client'
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react'
import type { Income } from '../types'

function IncomeRow({ inc, onEdit, onDelete }: { inc: Income; onEdit: (i: Income) => void; onDelete: (id: number) => void }) {
  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/30">
      <td className="px-4 py-3 font-medium capitalize text-slate-200">{inc.person}</td>
      <td className="px-4 py-3 text-slate-300">{inc.year}</td>
      <td className="px-4 py-3 text-right text-slate-300">{fmt(inc.employment_income)}</td>
      <td className="px-4 py-3 text-right text-slate-300">{fmt(inc.bonus + inc.other_bonus)}</td>
      <td className="px-4 py-3 text-right font-medium text-slate-100">{fmt(inc.total_gross)}</td>
      <td className="px-4 py-3 text-center text-xs">
        {inc.is_maternity_leave ? <span className="bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full">Mat Leave</span> : '—'}
      </td>
      <td className="px-4 py-3 text-slate-400 text-sm">{inc.notes}</td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <button onClick={() => onEdit(inc)} className="p-1.5 text-slate-400 hover:text-blue-400"><Edit2 size={14} /></button>
          <button onClick={() => onDelete(inc.id)} className="p-1.5 text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
        </div>
      </td>
    </tr>
  )
}

function IncomeModal({ income, onClose }: { income: Income | null; onClose: () => void }) {
  const qc = useQueryClient()
  const isNew = !income?.id
  const [form, setForm] = useState<Partial<Income>>(income ?? {
    person: 'sean', year: new Date().getFullYear() + 1, employment_income: 0, bonus: 0, other_bonus: 0,
    investment_income: 0, rental_income: 0, other_income: 0, province: 'ON',
    is_maternity_leave: false, maternity_ei_income: 0, notes: '',
  })
  const mut = useMutation({
    mutationFn: () => isNew ? createIncome(form) : updateIncome(income!.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['income'] }); onClose() },
  })
  const n = (label: string, key: keyof typeof form, type: 'number' | 'text' | 'checkbox' = 'number') => (
    <div>
      <label className="label">{label}</label>
      {type === 'checkbox'
        ? <input type="checkbox" checked={!!form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} className="w-4 h-4 mt-1" />
        : <input type={type} className="input" value={(form[key] as string | number) ?? ''} onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))} />
      }
    </div>
  )
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-auto">
      <div className="card w-full max-w-lg">
        <div className="flex justify-between mb-4">
          <h2 className="font-semibold text-slate-100">{isNew ? 'Add Income Year' : 'Edit Income'}</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Person</label>
            <select className="input" value={form.person} onChange={e => setForm(f => ({ ...f, person: e.target.value }))}>
              <option value="sean">Sean</option><option value="saudya">Saudya</option>
            </select>
          </div>
          {n('Year', 'year')}
          {n('Employment Income', 'employment_income')}
          {n('Bonus', 'bonus')}
          {n('Other Bonus', 'other_bonus')}
          {n('Investment Income', 'investment_income')}
          {n('Rental Income', 'rental_income')}
          {n('Other Income', 'other_income')}
          <div>
            <label className="label">Maternity Leave?</label>
            <input type="checkbox" checked={!!form.is_maternity_leave} onChange={e => setForm(f => ({ ...f, is_maternity_leave: e.target.checked }))} className="w-4 h-4 mt-1" />
          </div>
          {form.is_maternity_leave && n('EI Maternity Income', 'maternity_ei_income')}
          <div className="col-span-2">{n('Notes', 'notes', 'text')}</div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={() => mut.mutate()} disabled={mut.isPending} className="btn-primary flex-1">
            {mut.isPending ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function IncomePage() {
  const qc = useQueryClient()
  const { data: incomes = [] } = useQuery({ queryKey: ['income'], queryFn: () => getIncome() })
  const [editing, setEditing] = useState<Income | null | 'new'>()

  const deleteMut = useMutation({
    mutationFn: deleteIncome,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['income'] }),
  })

  const sorted = [...incomes].sort((a, b) => b.year - a.year || a.person.localeCompare(b.person))
  const years = [...new Set(sorted.map(i => i.year))].sort((a, b) => b - a)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Income</h1>
          <p className="text-slate-400 text-sm mt-1">Track gross income by year — used in tax calculations and forecasts</p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Year
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              {['Person', 'Year', 'Employment', 'Bonus', 'Total Gross', 'Status', 'Notes', ''].map(h => (
                <th key={h} className="px-4 py-3 text-right first:text-left text-xs text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(inc => (
              <IncomeRow key={inc.id} inc={inc}
                onEdit={setEditing}
                onDelete={id => { if (confirm('Delete this income record?')) deleteMut.mutate(id) }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {years.slice(0, 3).map(year => {
          const yearRows = sorted.filter(i => i.year === year)
          const total = yearRows.reduce((s, i) => s + i.total_gross, 0)
          return (
            <div key={year} className="card">
              <div className="text-slate-500 text-xs uppercase mb-2">{year} Combined</div>
              <div className="text-xl font-bold text-slate-100 mb-3">{fmt(total)}</div>
              {yearRows.map(i => (
                <div key={i.id} className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400 capitalize">{i.person}</span>
                  <span className="text-slate-200">{fmt(i.total_gross)}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {editing && (
        <IncomeModal
          income={editing === 'new' ? null : editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  )
}
