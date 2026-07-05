import { useState } from 'react'
import { Search, CheckCircle, XCircle, Clock, Loader2, AlertCircle } from 'lucide-react'
import { checkCDKKeyStatus } from '../admin/db'
import { STATUS_LABELS } from '../admin/types'

interface CDKKeyCheckerProps {
  lang: 'zh' | 'en'
  onClose: () => void
}

export default function CDKKeyChecker({ lang, onClose }: CDKKeyCheckerProps) {
  const [input, setInput] = useState('')
  const [results, setResults] = useState<{ key: string; status?: string; email?: string; found: boolean }[]>([])
  const [checking, setChecking] = useState(false)

  const labels = {
    zh: {
      title: '检查 CDK Key',
      placeholder: '输入一个或多个 key（每行一个）',
      check: '检查',
      checking: '正在检查...',
      notFound: '系统中未找到',
      success: '激活成功',
      noResults: '暂无结果。输入 key 后点击检查。',
    },
    en: {
      title: 'Check CDK Key',
      placeholder: 'Enter 1 or more keys (one per line)',
      check: 'Check',
      checking: 'Checking...',
      notFound: 'Not found in system',
      success: 'Activated successfully',
      noResults: 'No results yet. Enter keys and click Check.',
    },
  }
  const t = labels[lang]

  async function handleCheck() {
    const lines = input.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    setChecking(true)
    setResults([])
    await new Promise(r => setTimeout(r, 300))
    const res = await Promise.all(
      lines.map(async line => {
        const found = await checkCDKKeyStatus(line)
        return {
          key: line,
          found: !!found,
          status: found?.status,
          email: found?.activatedEmail,
        }
      })
    )
    setResults(res)
    setChecking(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2a2d3a]">
          <div className="flex items-center gap-2">
            <Search size={16} className="text-indigo-400" strokeWidth={1.5} />
            <h3 className="text-sm font-bold text-slate-100">{t.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t.placeholder}
            className="w-full h-28 bg-[#22253a] border border-[#2a2d3a] rounded-xl px-4 py-3 text-xs font-mono text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500/50 transition-all"
          />

          <button
            onClick={handleCheck}
            disabled={checking || !input.trim()}
            className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {checking ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {t.checking}
              </>
            ) : (
              <>
                <Search size={14} strokeWidth={2} />
                {t.check}
              </>
            )}
          </button>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-3 bg-[#22253a] rounded-xl px-3 py-2.5">
                  <div className="flex-shrink-0">
                    {r.status === 'live' && (
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <CheckCircle size={14} className="text-emerald-400" strokeWidth={1.5} />
                      </div>
                    )}
                    {r.status === 'used' && (
                      <div className="w-6 h-6 rounded-full bg-slate-500/20 flex items-center justify-center">
                        <Clock size={14} className="text-slate-400" strokeWidth={1.5} />
                      </div>
                    )}
                    {r.status === 'disabled' && (
                      <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                        <XCircle size={14} className="text-red-400" strokeWidth={1.5} />
                      </div>
                    )}
                    {!r.found && (
                      <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <AlertCircle size={14} className="text-yellow-400" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-semibold text-slate-200">{r.key}</p>
                    {r.found && r.email && (
                      <p className="text-[10px] text-slate-500 truncate">{r.email}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {r.status === 'live' && (
                      <span className="text-xs font-bold text-emerald-400">{STATUS_LABELS.live[lang === 'zh' ? 'zh' : 'en']}</span>
                    )}
                    {r.status === 'used' && (
                      <span className="text-xs font-bold text-slate-400">{STATUS_LABELS.used[lang === 'zh' ? 'zh' : 'en']}</span>
                    )}
                    {r.status === 'disabled' && (
                      <span className="text-xs font-bold text-red-400">{STATUS_LABELS.disabled[lang === 'zh' ? 'zh' : 'en']}</span>
                    )}
                    {!r.found && (
                      <span className="text-xs font-bold text-yellow-400">{t.notFound}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.length === 0 && !checking && input && (
            <p className="text-center text-xs text-slate-600 py-2">{t.noResults}</p>
          )}
        </div>
      </div>
    </div>
  )
}
