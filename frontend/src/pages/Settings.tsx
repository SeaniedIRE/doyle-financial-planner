import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings } from '../api/accounts'
import { Save, Upload } from 'lucide-react'
import api from '../api/client'

export default function Settings() {
  const qc = useQueryClient()
  const { data: settings = {} } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const [form, setForm] = useState<Record<string, string>>({})
  const [csvText, setCsvText] = useState('')
  const [importResult, setImportResult] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const currentSettings = { ...settings, ...form }

  const saveMut = useMutation({
    mutationFn: () => updateSettings(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); setForm({}) },
  })

  const handleImport = async () => {
    setImporting(true)
    try {
      const res = await api.post('/accounts/holdings/import-csv', csvText, {
        headers: { 'Content-Type': 'text/plain' },
      })
      setImportResult(`✅ ${res.data.message}`)
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['holdings'] })
      qc.invalidateQueries({ queryKey: ['totals'] })
    } catch (e) {
      setImportResult('❌ Import failed. Make sure the CSV matches your broker\'s format.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Settings</h1>

      {/* App Settings */}
      <div className="card mb-6">
        <h2 className="font-semibold text-slate-200 mb-4">App Settings</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'fx_cad_usd', label: 'CAD/USD Exchange Rate', help: 'Used to convert USD positions (e.g. PSNY) to CAD' },
            { key: 'sean_canada_since', label: 'Sean Canada Resident Since (Year)', help: 'Used to calculate TFSA cumulative room' },
            { key: 'saudya_canada_since', label: 'Saudya Canada Resident Since (Year)', help: 'Used to calculate TFSA cumulative room' },
            { key: 'province', label: 'Province', help: 'Used for provincial tax calculations' },
          ].map(({ key, label, help }) => (
            <div key={key} className="col-span-2 md:col-span-1">
              <label className="label">{label}</label>
              <input type="text" className="input"
                value={form[key] ?? currentSettings[key] ?? ''}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              <div className="text-xs text-slate-600 mt-0.5">{help}</div>
            </div>
          ))}
        </div>
        <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || Object.keys(form).length === 0}
          className="btn-primary mt-4 flex items-center gap-2">
          <Save size={14} />
          {saveMut.isPending ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      {/* CSV Import */}
      <div className="card mb-6">
        <h2 className="font-semibold text-slate-200 mb-2">Import Holdings from Broker CSV</h2>
        <p className="text-sm text-slate-400 mb-4">
          Paste the contents of your broker's holdings CSV below. The importer will update quantities, prices,
          and market values for existing holdings matched by symbol + account number. It will not delete any positions.
        </p>
        <p className="text-xs text-amber-300 mb-3">
          ⚠ This will overwrite current prices/quantities for matched holdings. New securities in the CSV will be ignored
          (add them manually in Holdings if needed).
        </p>
        <textarea
          className="input h-48 font-mono text-xs resize-none"
          placeholder={'Account Name,Account Type,...\n"TFSA","TFSA","Trade","HQ8DKCMK3CAD","VFV",...'}
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
        />
        <button onClick={handleImport} disabled={importing || !csvText.trim()}
          className="btn-primary mt-3 flex items-center gap-2">
          <Upload size={14} />
          {importing ? 'Importing…' : 'Import & Update Holdings'}
        </button>
        {importResult && <div className="mt-3 text-sm">{importResult}</div>}
      </div>

      {/* About */}
      <div className="card">
        <h2 className="font-semibold text-slate-200 mb-3">About</h2>
        <div className="text-sm text-slate-400 space-y-2">
          <div>Doyle Financial Planner v1.0 — Sean & Saudya Doyle</div>
          <div>Tax calculations based on CRA 2026 rules. Federal + Ontario provincial.</div>
          <div>Capital gains inclusion rate: 50% (ITA s.38, 2026).</div>
          <div>AI analysis powered by Claude (Anthropic). Not professional financial advice.</div>
          <div className="pt-2 text-slate-600">
            Data is stored locally in SQLite at /app/data/financial_planner.db inside the Docker container.
            Back up by copying this file regularly.
          </div>
        </div>
      </div>
    </div>
  )
}
