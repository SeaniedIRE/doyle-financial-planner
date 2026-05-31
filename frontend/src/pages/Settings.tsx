import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings } from '../api/accounts'
import { Save, Upload, FileText, X } from 'lucide-react'
import api from '../api/client'

export default function Settings() {
  const qc = useQueryClient()
  const { data: settings = {} } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const [form, setForm] = useState<Record<string, string>>({})
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const currentSettings = { ...settings, ...form }

  const saveMut = useMutation({
    mutationFn: () => updateSettings(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); setForm({}) },
  })

  const acceptFile = (file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'text/plain') {
      setImportResult('❌ Please select a .csv file.')
      return
    }
    setCsvFile(file)
    setImportResult(null)
  }

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) acceptFile(e.target.files[0])
  }

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.[0]) acceptFile(e.dataTransfer.files[0])
  }, [])

  const handleImport = async () => {
    if (!csvFile) return
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', csvFile)
      const res = await api.post('/accounts/holdings/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportResult(`✅ ${res.data.message}`)
      setCsvFile(null)
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['holdings'] })
      qc.invalidateQueries({ queryKey: ['totals'] })
    } catch (e) {
      setImportResult('❌ Import failed — check that the CSV has the required columns (see below).')
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
        <p className="text-sm text-slate-400 mb-3">
          Drop your broker's CSV file below (or click to browse). Updates quantities, prices, and market values
          for holdings matched by symbol + account number. Does not delete positions.
        </p>
        <p className="text-xs text-amber-300 mb-4">
          ⚠ Overwrites current prices/quantities for matched holdings. New symbols are ignored — add them manually.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !csvFile && document.getElementById('csv-file-input')?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer select-none
            ${dragOver ? 'border-blue-400 bg-blue-950/30' : csvFile ? 'border-emerald-500 bg-emerald-950/20' : 'border-slate-600 hover:border-slate-400'}`}
        >
          {csvFile ? (
            <div className="flex items-center justify-center gap-3">
              <FileText size={20} className="text-emerald-400" />
              <span className="text-sm text-emerald-300 font-mono">{csvFile.name}</span>
              <button
                onClick={e => { e.stopPropagation(); setCsvFile(null); setImportResult(null) }}
                className="text-slate-400 hover:text-red-400 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="text-slate-400">
              <Upload size={24} className="mx-auto mb-2 text-slate-500" />
              <div className="text-sm">Drop CSV here or <span className="text-blue-400 underline">browse</span></div>
            </div>
          )}
        </div>
        <input id="csv-file-input" type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={onFileInput} />

        <button onClick={handleImport} disabled={importing || !csvFile}
          className="btn-primary mt-3 flex items-center gap-2 disabled:opacity-40">
          <Upload size={14} />
          {importing ? 'Importing…' : 'Import & Update Holdings'}
        </button>
        {importResult && <div className="mt-3 text-sm">{importResult}</div>}

        {/* Required format reference */}
        <details className="mt-4">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">Required CSV format</summary>
          <div className="mt-2 text-xs font-mono bg-slate-900 rounded p-3 text-slate-300 overflow-x-auto">
            <div className="text-slate-500 mb-1"># Required columns (header row must match exactly):</div>
            <div>Account Number,Symbol,Quantity,Market Price,Book Value (CAD),Market Value</div>
            <div className="text-slate-500 mt-2 mb-1"># Example row:</div>
            <div>HQ8DKCMK3CAD,VFV,42.5,120.00,4800.00,5100.00</div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            If your broker exports different column names, paste the CSV into Claude and use the prompt below to reformat it.
          </p>
        </details>
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
