import { useState, useRef } from 'react'
import { Key, ArrowRight, Search, AlertCircle, Loader2, CheckCircle } from 'lucide-react'
import CDKKeyChecker from './CDKKeyChecker'
import { checkCDKKeyStatus } from '../admin/db'

interface StepCDKProps {
  lang: 'zh' | 'en'
  onNext: (key: string) => void
}

type Status = 'idle' | 'checking' | 'valid' | 'used' | 'disabled' | 'notfound'

export default function StepCDK({ lang, onNext }: StepCDKProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [showChecker, setShowChecker] = useState(false)
  const [shake, setShake] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCheckedRef = useRef<string>('')

  const labels = {
    zh: {
      title: '输入 CDK',
      subtitle: '第 1 步，共 3 步',
      desc: '输入你的 CDK，开始激活 Plus。',
      placeholder: '例如：ABCD-1234-EFGH',
      checkKey: '检查 Key',
      next: '继续',
      checking: '正在检查...',
      statusUsed: '该 CDK 已被使用。',
      statusDisabled: '该 CDK 已被禁用。',
      statusNotFound: '系统中未找到该 CDK。',
      statusValid: 'CDK 有效，可以激活。',
      error: 'CDK 至少需要 4 个字符。',
    },
    en: {
      title: 'Enter CDK Code',
      subtitle: 'Step 1 of 3',
      desc: 'Enter your CDK code to start Plus activation.',
      placeholder: 'e.g. ABCD-1234-EFGH',
      checkKey: 'Check Key',
      next: 'Continue',
      checking: 'Checking...',
      statusUsed: 'This key has already been used.',
      statusDisabled: 'This key has been disabled.',
      statusNotFound: 'CDK key not found in system.',
      statusValid: 'Valid key - ready to activate.',
      error: 'CDK code must be at least 4 characters.',
    },
  }
  const t = labels[lang]

  async function checkKey(rawKey: string): Promise<Status> {
    const key = rawKey.trim()
    if (key === lastCheckedRef.current && status !== 'idle') {
      return status
    }
    lastCheckedRef.current = key
    setStatus('checking')

    try {
      const record = await checkCDKKeyStatus(key)
      if (!record) return (setStatus('notfound'), 'notfound' as Status)
      if (record.status === 'used') return (setStatus('used'), 'used' as Status)
      if (record.status === 'disabled') return (setStatus('disabled'), 'disabled' as Status)
      return (setStatus('valid'), 'valid' as Status)
    } catch {
      setStatus('notfound')
      return 'notfound'
    }
  }

  function debouncedCheck(key: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      checkKey(key)
    }, 500)
  }

  async function handleSubmit() {
    const trimmed = value.trim()
    if (trimmed.length < 4) {
      setError(t.error)
      setShake(true)
      setTimeout(() => setShake(false), 500)
      return
    }
    setError('')

    // Cancel any pending debounced check
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    // Always verify on Enter - never trust stale status
    const result = await checkKey(trimmed)
    if (result !== 'valid') {
      setShake(true)
      setTimeout(() => setShake(false), 500)
      return
    }

    onNext(trimmed.toUpperCase())
  }

  return (
    <>
      <div className={`animate-fade-in-up ${shake ? 'animate-shake' : ''}`}>
        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <Key size={20} className="text-indigo-400" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">{t.title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t.subtitle}</p>
            </div>
          </div>

          <p className="text-xs text-slate-400 mb-5 leading-relaxed">{t.desc}</p>

          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                value={value}
                onChange={e => {
                  const upper = e.target.value.toUpperCase()
                  setValue(upper)
                  if (error) setError('')
                  if (upper.length >= 4) {
                    debouncedCheck(upper)
                  } else {
                    if (debounceRef.current) clearTimeout(debounceRef.current)
                    setStatus('idle')
                  }
                }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder={t.placeholder}
                className={`w-full bg-[#22253a] border rounded-xl px-4 py-3.5 text-sm font-mono font-semibold text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 transition-all pr-10 ${
                  (status === 'used' || status === 'disabled' || status === 'notfound' || error)
                    ? 'border-red-500/60 focus:border-red-500/80 focus:ring-red-500/20'
                    : status === 'valid'
                    ? 'border-emerald-500/60 focus:border-emerald-500/80 focus:ring-emerald-500/20'
                    : 'border-[#2a2d3a] focus:border-indigo-500/60 focus:ring-indigo-500/20'
                }`}
                autoFocus
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {status === 'checking' && (
                  <Loader2 size={16} className="text-slate-400 animate-spin" strokeWidth={1.5} />
                )}
                {(status === 'used' || status === 'disabled' || status === 'notfound' || error) && (
                  <AlertCircle size={16} className="text-red-400" strokeWidth={1.5} />
                )}
                {status === 'valid' && (
                  <CheckCircle size={16} className="text-emerald-400" strokeWidth={1.5} />
                )}
              </div>
            </div>

            {status === 'checking' && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" />
                {t.checking}
              </p>
            )}
            {status === 'used' && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle size={12} strokeWidth={1.5} />
                {t.statusUsed}
              </p>
            )}
            {status === 'disabled' && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle size={12} strokeWidth={1.5} />
                {t.statusDisabled}
              </p>
            )}
            {status === 'notfound' && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle size={12} strokeWidth={1.5} />
                {t.statusNotFound}
              </p>
            )}
            {status === 'valid' && (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                <CheckCircle size={12} strokeWidth={1.5} />
                {t.statusValid}
              </p>
            )}
            {error && !status && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle size={12} strokeWidth={1.5} />
                {error}
              </p>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setShowChecker(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-2.5 rounded-xl bg-[#22253a] border border-[#2a2d3a] text-slate-400 hover:text-indigo-300 hover:border-indigo-500/30 transition-all"
            >
              <Search size={13} strokeWidth={1.5} />
              {t.checkKey}
            </button>
            <button
              onClick={handleSubmit}
              disabled={status !== 'valid'}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-bold text-sm py-3 rounded-xl transition-all active:scale-[0.97] shadow-lg shadow-indigo-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t.next}
              <ArrowRight size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {showChecker && (
        <CDKKeyChecker lang={lang} onClose={() => setShowChecker(false)} />
      )}
    </>
  )
}
