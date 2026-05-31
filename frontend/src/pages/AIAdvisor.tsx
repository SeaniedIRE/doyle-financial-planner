import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { askClaude, getAnnualReview, getAIKeyStatus, setAIKey } from '../api/ai'
import ReactMarkdown from 'react-markdown'
import { Bot, Send, RefreshCw, Key, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react'

const QUICK_PROMPTS = [
  { label: '2026 Year-End Checklist', fn: () => getAnnualReview(2026) },
]

const SUGGESTED_QUESTIONS = [
  "What is the optimal order to draw down accounts in retirement?",
  "Should we use the RRSP Home Buyers' Plan or rely only on FHSA for the house?",
  "How can we best use the capital loss on PSNY to reduce taxes?",
  "What are the spousal RRSP rules and should Sean contribute to Saudya's RRSP?",
  "How does Saudya's LIRA work and when can she access it?",
  "What are the tax implications of the Global X corporate class ETFs in non-registered accounts?",
  "How should we adjust our portfolio as we approach the house purchase in 2030?",
  "What are the CRA rules on superficial losses if we sell PSNY?",
]

// ─── API Key Setup Card ───────────────────────────────────────────────────────

function KeySetupCard({ onConfigured }: { onConfigured: () => void }) {
  const qc = useQueryClient()
  const [keyInput, setKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mut = useMutation({
    mutationFn: () => setAIKey(keyInput.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-key-status'] })
      onConfigured()
    },
    onError: (e: any) => {
      setError(e?.response?.data?.detail ?? 'Failed to save key — check format.')
    },
  })

  return (
    <div className="card mb-6 border border-amber-600/40 bg-amber-950/20">
      <div className="flex items-start gap-3 mb-4">
        <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold text-slate-100 mb-1">Anthropic API Key Required</h2>
          <p className="text-sm text-slate-400">
            AI Advisor needs an Anthropic API key to work. Get yours at{' '}
            <span className="text-blue-400">console.anthropic.com</span>.
            The key is stored in the app database and never leaves your server.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <label className="label">Anthropic API Key</label>
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              className="input flex-1 font-mono text-sm"
              placeholder="sk-ant-api03-…"
              value={keyInput}
              onChange={e => { setKeyInput(e.target.value); setError(null) }}
            />
            <button type="button" onClick={() => setShowKey(s => !s)}
              className="px-3 text-slate-400 hover:text-slate-200 border border-slate-600 rounded-lg transition-colors">
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && <div className="mt-1 text-xs text-red-400">{error}</div>}
        </div>

        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || keyInput.length < 20}
          className="btn-primary flex items-center gap-2">
          <Key size={14} />
          {mut.isPending ? 'Saving…' : 'Save API Key'}
        </button>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-700 text-xs text-slate-500">
        Alternatively, set <code className="text-slate-300">ANTHROPIC_API_KEY</code> as a Docker environment variable —
        that takes priority and no key needs to be entered here.
      </div>
    </div>
  )
}

// ─── Key Status Badge ─────────────────────────────────────────────────────────

function KeyStatusBadge({ source }: { source: 'env' | 'db' | 'none' }) {
  if (source === 'none') return null
  return (
    <div className="flex items-center gap-1.5 text-xs text-emerald-400">
      <CheckCircle size={12} />
      {source === 'env' ? 'Key set via Docker env' : 'Key set via app settings'}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AIAdvisor() {
  const qc = useQueryClient()
  const [question, setQuestion] = useState('')
  const [includeContext, setIncludeContext] = useState(true)
  const [response, setResponse] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<Array<{ q: string; a: string }>>([])
  const [showSetup, setShowSetup] = useState(false)

  const { data: keyStatus } = useQuery({
    queryKey: ['ai-key-status'],
    queryFn: getAIKeyStatus,
    staleTime: 30_000,
  })

  const keyConfigured = keyStatus?.configured ?? false

  const ask = async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setResponse(null)
    try {
      const text = await askClaude(q, includeContext)
      setResponse(text)
      setHistory(h => [{ q, a: text }, ...h].slice(0, 10))
    } finally {
      setLoading(false)
    }
  }

  const runQuickPrompt = async (fn: () => Promise<string>) => {
    setLoading(true)
    setResponse(null)
    try {
      const text = await fn()
      setResponse(text)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Bot size={28} className="text-blue-400" />
          <h1 className="text-2xl font-bold text-slate-100">AI Financial Advisor</h1>
        </div>
        {keyStatus && <KeyStatusBadge source={keyStatus.source} />}
      </div>
      <p className="text-slate-400 text-sm mb-6">
        Powered by Claude — specialised in Canadian tax law, CRA rules, and investment strategy.
        Your portfolio data is automatically included for personalised answers.
      </p>

      {/* API key setup — shown when not configured or user requests it */}
      {(!keyConfigured || showSetup) && (
        <KeySetupCard onConfigured={() => {
          setShowSetup(false)
          qc.invalidateQueries({ queryKey: ['ai-key-status'] })
        }} />
      )}

      {/* Quick actions */}
      <div className="card mb-6">
        <h2 className="font-semibold text-slate-200 mb-3">Quick Analysis</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map(({ label, fn }) => (
            <button key={label} onClick={() => runQuickPrompt(fn)} disabled={loading}
              className="btn-secondary text-sm flex items-center gap-1.5">
              <RefreshCw size={13} />
              {label}
            </button>
          ))}
          {['2026 Annual Review', 'FHSA Strategy', 'PSNY Loss Harvesting'].map(label => (
            <button key={label} disabled={loading} onClick={() => ask(`Please provide a ${label} analysis for Sean and Saudya Doyle based on their current portfolio.`)}
              className="btn-secondary text-sm">
              {label}
            </button>
          ))}
          {keyConfigured && (
            <button onClick={() => setShowSetup(s => !s)}
              className="btn-secondary text-sm flex items-center gap-1.5 text-slate-500">
              <Key size={12} />
              {showSetup ? 'Hide key setup' : 'Update API key'}
            </button>
          )}
        </div>
      </div>

      {/* Question input */}
      <div className="card mb-6">
        <div className="flex items-start gap-3">
          <textarea
            className="input flex-1 h-24 resize-none"
            placeholder={keyConfigured ? "Ask anything about your finances, tax strategy, CRA rules…" : "Configure your API key above to start asking questions…"}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) ask(question) }}
          />
          <div className="flex flex-col gap-2">
            <button onClick={() => ask(question)} disabled={loading || !question.trim() || !keyConfigured}
              className="btn-primary flex items-center gap-2 whitespace-nowrap">
              <Send size={15} />
              {loading ? 'Thinking…' : 'Ask Claude'}
            </button>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={includeContext} onChange={e => setIncludeContext(e.target.checked)} />
              Include portfolio
            </label>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-500">⌘+Enter to submit</div>
      </div>

      {/* Suggested questions */}
      {!response && !loading && keyConfigured && (
        <div className="card mb-6">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Suggested Questions</h3>
          <div className="space-y-2">
            {SUGGESTED_QUESTIONS.map(q => (
              <button key={q} onClick={() => { setQuestion(q); ask(q) }}
                className="w-full text-left text-sm text-slate-300 hover:text-blue-300 p-2 rounded-lg hover:bg-slate-800 transition-colors">
                → {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Response */}
      {loading && (
        <div className="card flex items-center gap-3 text-slate-400">
          <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
          Claude is analysing your portfolio…
        </div>
      )}

      {response && (
        <div className="card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={16} className="text-blue-400" />
            <span className="text-sm font-medium text-blue-300">Claude's Response</span>
          </div>
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown>{response}</ReactMarkdown>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-700 text-xs text-slate-500">
            ⚠ This is AI-generated financial information, not professional advice. Always verify CRA rules at canada.ca and consult a qualified financial advisor for major decisions.
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="card">
          <h2 className="font-semibold text-slate-200 mb-4">Previous Questions</h2>
          <div className="space-y-4">
            {history.slice(1).map((item, i) => (
              <div key={i} className="border-b border-slate-700 pb-4 last:border-0">
                <div className="text-sm text-slate-400 mb-2">Q: {item.q}</div>
                <div className="prose prose-sm prose-invert max-w-none opacity-70">
                  <ReactMarkdown>{item.a.slice(0, 300) + (item.a.length > 300 ? '…' : '')}</ReactMarkdown>
                </div>
                <button onClick={() => setResponse(item.a)} className="text-xs text-blue-400 hover:underline mt-1">
                  Show full response
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
