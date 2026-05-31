import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings } from '../api/accounts'
import { getAIKeyStatus, setAIKey } from '../api/ai'
import { Save, Upload, FileText, X, Key, CheckCircle, Eye, EyeOff } from 'lucide-react'
import api from '../api/client'

export default function Settings() {
  const qc = useQueryClient()
  const { data: settings = {} } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const [form, setForm] = useState<Record<string, string>>({})

  // AI key state
  const { data: keyStatus } = useQuery({ queryKey: ['ai-key-status'], queryFn: getAIKeyStatus, staleTime: 30_000 })
  const [newKey, setNewKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)
  const setKeyMut = useMutation({
    mutationFn: () => setAIKey(newKey.trim()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ai-key-status'] }); setNewKey(''); setKeyError(null) },
    onError: (e: any) => setKeyError(e?.response?.data?.detail ?? 'Failed to save key.'),
  })
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importOwner, setImportOwner] = useState<'all' | 'sean' | 'saudya'>('all')
  const [createMissing, setCreateMissing] = useState(false)

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
      if (importOwner !== 'all') formData.append('owner', importOwner)
      formData.append('create_missing', createMissing ? 'true' : 'false')
      const res = await api.post('/accounts/holdings/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportResult(`✅ ${res.data.message}`)
      setCsvFile(null)
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['holdings'] })
      qc.invalidateQueries({ queryKey: ['totals'] })
    } catch (e) {
      setImportResult('❌ Import failed — check the container log for details.')
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

      {/* AI Advisor Key */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-200">AI Advisor Key</h2>
          {keyStatus?.configured && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle size={12} />
              {keyStatus.source === 'env' ? 'Set via Docker env var (priority)' : 'Set via app database'}
            </div>
          )}
          {keyStatus && !keyStatus.configured && (
            <span className="text-xs text-amber-400">Not configured</span>
          )}
        </div>
        <p className="text-sm text-slate-400 mb-4">
          The Anthropic API key powers the AI Advisor. If you set{' '}
          <code className="text-slate-300 bg-slate-800 px-1 rounded">ANTHROPIC_API_KEY</code> as a Docker
          environment variable it takes priority. You can also paste a key here to store it in the database.
        </p>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="label">
              {keyStatus?.configured ? 'Replace API Key' : 'Paste API Key'}
            </label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                className="input flex-1 font-mono text-sm"
                placeholder="sk-ant-api03-…"
                value={newKey}
                onChange={e => { setNewKey(e.target.value); setKeyError(null) }}
              />
              <button type="button" onClick={() => setShowKey(s => !s)}
                className="px-3 text-slate-400 hover:text-slate-200 border border-slate-600 rounded-lg transition-colors">
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {keyError && <div className="mt-1 text-xs text-red-400">{keyError}</div>}
          </div>
          <button onClick={() => setKeyMut.mutate()} disabled={setKeyMut.isPending || newKey.length < 20}
            className="btn-primary flex items-center gap-2 h-10">
            <Key size={14} />
            {setKeyMut.isPending ? 'Saving…' : 'Save Key'}
          </button>
        </div>
        {setKeyMut.isSuccess && (
          <div className="mt-2 text-sm text-emerald-400">✅ Key saved — AI Advisor is ready.</div>
        )}
      </div>

      {/* CSV Import */}
      <div className="card mb-6">
        <h2 className="font-semibold text-slate-200 mb-2">Import Holdings from Broker CSV</h2>
        <p className="text-sm text-slate-400 mb-3">
          Drop your broker's native CSV export below — no reformatting needed. Updates quantities,
          prices, and market values for holdings matched by symbol + account number.
          USD-priced positions (e.g. PSNY) are converted to CAD automatically using your stored FX rate.
        </p>
        <p className="text-xs text-amber-300 mb-4">
          ⚠ Overwrites current prices/quantities for matched holdings.
          Enable <strong>Create missing holdings</strong> below for the first import — subsequent imports can leave it off.
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

        {/* Person filter */}
        <div className="mt-4">
          <p className="text-xs text-slate-400 mb-2">
            Update accounts for:
            <span className="text-slate-500 ml-1">
              (separate imports are already safe — account numbers never overlap between people)
            </span>
          </p>
          <div className="flex gap-2">
            {(['all', 'sean', 'saudya'] as const).map(o => (
              <button
                key={o}
                type="button"
                onClick={() => setImportOwner(o)}
                className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${
                  importOwner === o
                    ? 'border-blue-500 bg-blue-900/40 text-blue-200'
                    : 'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-300'
                }`}
              >
                {o === 'all' ? 'All accounts' : o === 'sean' ? 'Sean only' : 'Saudya only'}
              </button>
            ))}
          </div>
        </div>

        {/* Create missing toggle */}
        <div className="mt-4 flex items-start gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={createMissing}
              onChange={e => setCreateMissing(e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            <span className="text-sm text-slate-300 font-medium">Create missing holdings</span>
          </label>
          <span className="text-xs text-slate-500 pt-0.5">
            {createMissing
              ? '🟢 ON — symbols not yet in the app will be created from the CSV (use for initial setup)'
              : '⚪ OFF — only existing holdings are updated (safe for routine imports)'}
          </span>
        </div>

        <button onClick={handleImport} disabled={importing || !csvFile}
          className="btn-primary mt-4 flex items-center gap-2 disabled:opacity-40">
          <Upload size={14} />
          {importing
            ? 'Importing…'
            : `${createMissing ? 'Full Import' : 'Update'} Holdings${importOwner !== 'all' ? ` (${importOwner})` : ''}`}
        </button>
        {importResult && <div className="mt-3 text-sm">{importResult}</div>}

        {/* Format reference */}
        <details className="mt-4">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">Supported CSV format</summary>
          <div className="mt-2 text-xs bg-slate-900 rounded p-3 text-slate-400 space-y-1">
            <p className="text-slate-300 font-medium">Your broker's native export works directly.</p>
            <p className="text-amber-300">First import: enable <strong>Create missing holdings</strong> above — account numbers must already match (fix them in Holdings → ⚙ Edit Account first).</p>
            <p className="mt-1">The importer reads these columns (others are ignored):</p>
            <p className="font-mono text-slate-300 mt-1">
              Account Number · Symbol · Quantity · Market Price · Book Value (CAD) · Market Value
            </p>
            <p className="mt-1">Optional broker columns used when present:</p>
            <p className="font-mono text-slate-300">
              Market Price Currency · Market Value Currency · Name
            </p>
            <p className="mt-1 text-slate-500">
              USD values are converted to CAD using Settings → CAD/USD Exchange Rate.
            </p>
          </div>
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
