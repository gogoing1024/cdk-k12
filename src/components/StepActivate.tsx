import { useState } from 'react'
import { Zap, ArrowLeft, CheckCircle, XCircle, Loader2, User, Download } from 'lucide-react'
import type { SessionData } from '../App'
import { getCDKKeyByKey, markCDKKeyUsed } from '../admin/db'
import { createActivationLog, type ActivationLogEntry } from '../lib/activationLog'

interface StepActivateProps {
  lang: 'zh' | 'en'
  cdkKey: string
  sessionData: SessionData | null
  onBack: () => void
}

export default function StepActivate({ lang, cdkKey, sessionData, onBack }: StepActivateProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [downloadFile, setDownloadFile] = useState<{ fileName: string; content: string } | null>(null)
  const [logs, setLogs] = useState<ActivationLogEntry[]>([])

  const labels = {
    zh: {
      title: '激活 Plus',
      subtitle: '第 3 步，共 3 步',
      desc: '信息已验证。点击下方按钮开始激活 ChatGPT Plus。',
      activateBtn: '立即激活',
      preparing: '正在激活...',
      exporting: '正在准备文件...',
      success: 'Plus 激活成功！',
      error: '激活失败',
      download: '下载 JSON 文件',
      exportFailed: '生成 JSON 文件失败',
      logsTitle: '处理日志',
      note: '如果账号状态没有变化，请刷新几次 ChatGPT 页面等待同步。',
      email: 'Email',
      accountId: 'Account ID',
      plan: '账号类型',
      retry: '重试',
      notFound: '系统中未找到该 CDK。',
      invalidKey: 'CDK 无效或已被禁用。',
      networkError: '连接失败，请检查网络。',
      serverError: '服务器错误，请稍后重试。',
    },
    en: {
      title: 'Activate Plus',
      subtitle: 'Step 3 of 3',
      desc: 'Information is valid. Click the button below to start activating ChatGPT Plus.',
      activateBtn: 'Activate Now',
      preparing: 'Activating...',
      exporting: 'Preparing JSON file...',
      success: 'Plus activation successful!',
      error: 'Activation failed',
      download: 'Download JSON',
      exportFailed: 'JSON export failed',
      logsTitle: 'Process Log',
      note: 'If account status does not change, reload the ChatGPT page a few times for data sync.',
      email: 'Email',
      accountId: 'Account ID',
      plan: 'Plan type',
      retry: 'Try again',
      notFound: 'CDK key not found in system.',
      invalidKey: 'CDK key is invalid or has been disabled.',
      networkError: 'Network error. Please check your connection.',
      serverError: 'Server error. Please try again later.',
    },
  }

  const t = labels[lang]

  function addLog(level: ActivationLogEntry['level'], message: string) {
    setLogs(prev => [...prev, createActivationLog(level, message)])
  }

  function appendServerLogs(serverLogs: unknown) {
    if (!Array.isArray(serverLogs)) return
    const safeLogs = serverLogs.filter((item): item is ActivationLogEntry => (
      item &&
      typeof item === 'object' &&
      ['info', 'success', 'warning', 'error'].includes((item as any).level) &&
      typeof (item as any).message === 'string' &&
      typeof (item as any).time === 'string'
    ))
    if (safeLogs.length > 0) {
      setLogs(prev => [...prev, ...safeLogs])
    }
  }

  function parseJwt(token: string) {
    try {
      const parts = token.split('.')
      if (parts.length < 2) return null
      return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    } catch {
      return null
    }
  }

  function parseError(text: string, status: number): string {
    if (status === 404) {
      if (text.includes('uuid') || text.includes('UUID')) {
        return t.invalidKey
      }
      return t.notFound
    }
    if (status === 0 || text.includes('Failed to fetch') || text.includes('NetworkError')) return t.networkError
    if (status >= 500) return t.serverError
    try {
      const json = JSON.parse(text)
      if (json.error) return json.error.message || json.error || text.slice(0, 100)
    } catch {}
    return text.slice(0, 150) || `HTTP ${status}`
  }

  function parseApiError(text: string, status: number): string {
    try {
      const json = JSON.parse(text)
      appendServerLogs(json?.logs)
      return json?.error?.detail || json?.error?.message || `HTTP ${status}`
    } catch {
      return text.slice(0, 150) || `HTTP ${status}`
    }
  }

  async function prepareExportFile(workspaceId: string) {
    if (!sessionData?.rawSession) {
      throw new Error('Missing AuthSession data')
    }

    const res = await fetch('/api/export-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId,
        session: sessionData.rawSession,
      }),
    })

    const text = await res.text()
    if (!res.ok) {
      throw new Error(parseApiError(text, res.status))
    }

    const data = JSON.parse(text) as { fileName?: string; exportJson?: unknown; logs?: unknown }
    appendServerLogs(data.logs)
    if (!data.fileName || !data.exportJson) {
      throw new Error(t.serverError)
    }

    setDownloadFile({
      fileName: data.fileName,
      content: `${JSON.stringify(data.exportJson, null, 2)}\n`,
    })
  }

  function downloadExportFile() {
    if (!downloadFile) return
    const blob = new Blob([downloadFile.content], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = downloadFile.fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  async function activate() {
    if (!sessionData) return
    setStatus('loading')
    setErrorMsg('')
    setExportError('')
    setDownloadFile(null)
    setExporting(false)
    setLogs([createActivationLog('info', '开始激活流程')])

    try {
      // Step 1: Look up CDK key to get workspace ID
      addLog('info', '正在校验 CDK')
      const cdkRecord = await getCDKKeyByKey(cdkKey)

      if (!cdkRecord) {
        addLog('error', t.notFound)
        setErrorMsg(t.notFound)
        setStatus('error')
        return
      }

      if (cdkRecord.status !== 'live') {
        addLog('error', t.invalidKey)
        setErrorMsg(t.invalidKey)
        setStatus('error')
        return
      }

      const workspaceId = cdkRecord.workspaceId
      addLog('success', `CDK 校验通过，workspace=${workspaceId.slice(0, 8)}...`)

      // Step 2: Call proxy (avoids browser CORS on chatgpt.com)
      addLog('info', '正在请求 ChatGPT 激活接口')
      const res = await fetch('/api/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId,
          accessToken: sessionData.accessToken,
        }),
      })

      const text = await res.text()

      if (res.ok) {
        // Step 3: Mark key as used
        addLog('success', `ChatGPT 激活接口返回 HTTP ${res.status}`)
        addLog('info', '正在标记 CDK 已使用')
        await markCDKKeyUsed(cdkKey, sessionData.user.email || '')
        addLog('success', 'CDK 已标记为已使用')
        setExporting(true)
        addLog('info', '正在切换 workspace 并生成下载 JSON')
        try {
          await prepareExportFile(workspaceId)
          addLog('success', '下载 JSON 已准备好')
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          addLog('warning', message)
          setExportError(message)
        } finally {
          setExporting(false)
        }
        setStatus('success')
      } else {
        const err = parseError(text, res.status)
        addLog('error', `ChatGPT 激活失败：${err}`)
        setErrorMsg(err)
        setStatus('error')
      }
    } catch (e) {
      addLog('error', t.networkError)
      setErrorMsg(t.networkError)
      setStatus('error')
    }
  }

  const jwt = sessionData?.accessToken ? parseJwt(sessionData.accessToken) : null
  const auth = jwt?.['https://api.openai.com/auth'] || {}
  const prof = jwt?.['https://api.openai.com/profile'] || {}
  const accountId = auth.chatgpt_account_id || sessionData?.user?.id || ''
  const email = prof.email || sessionData?.user?.email || ''
  const planType = auth.chatgpt_plan_type || ''

  return (
    <div className="animate-fade-in-up">
      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6 shadow-xl">
        {/* Title */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <Zap size={20} className="text-indigo-400" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">{t.title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t.subtitle}</p>
            </div>
          </div>
          {status === 'idle' && (
            <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
              <ArrowLeft size={14} strokeWidth={1.5} /> {lang === 'zh' ? '返回' : 'Back'}
            </button>
          )}
        </div>

        {/* User info */}
        <div className="bg-[#22253a] border border-[#2a2d3a] rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <User size={16} className="text-indigo-400" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500">{t.email}</p>
              <p className="text-xs font-semibold text-slate-200 truncate">{email || '—'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#1a1d27] rounded-lg px-3 py-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{t.accountId}</p>
              <p className="text-xs font-mono text-slate-300 truncate mt-0.5">{accountId ? `${accountId.slice(0, 10)}...` : '—'}</p>
            </div>
            <div className="bg-[#1a1d27] rounded-lg px-3 py-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{t.plan}</p>
              <p className="text-xs font-semibold text-slate-300 mt-0.5">{planType || '—'}</p>
            </div>
          </div>
        </div>

        {/* CDK key display */}
        <div className="bg-[#22253a] border border-[#2a2d3a] rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">CDK Key</p>
            <p className="text-sm font-mono font-bold text-indigo-300 mt-0.5">{cdkKey}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
            <Zap size={16} className="text-indigo-400" strokeWidth={1.5} />
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-400 mb-5 leading-relaxed">{t.desc}</p>

        {logs.length > 0 && (
          <div className="bg-[#0f1117] border border-[#2a2d3a] rounded-xl p-3 mb-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">{t.logsTitle}</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={`${log.time}-${index}`} className="grid grid-cols-[56px_8px_1fr] gap-2 items-start text-[11px] leading-relaxed">
                  <span className="font-mono text-slate-600">{log.time}</span>
                  <span className={
                    log.level === 'success' ? 'text-emerald-400' :
                    log.level === 'warning' ? 'text-amber-400' :
                    log.level === 'error' ? 'text-red-400' :
                    'text-indigo-400'
                  }>●</span>
                  <span className={
                    log.level === 'success' ? 'text-emerald-300' :
                    log.level === 'warning' ? 'text-amber-300' :
                    log.level === 'error' ? 'text-red-300' :
                    'text-slate-400'
                  }>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action */}
        {status === 'idle' && (
          <button
            onClick={activate}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-bold text-sm py-4 rounded-xl transition-all active:scale-[0.97] shadow-lg shadow-indigo-500/25 text-center"
          >
            {t.activateBtn}
          </button>
        )}

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="relative">
              <Loader2 size={36} className="text-indigo-400 animate-spin" strokeWidth={1.5} />
              <div className="absolute inset-0 rounded-full border-2 border-indigo-400/20 animate-ping" />
            </div>
            <p className="text-sm text-slate-400 font-medium">{exporting ? t.exporting : t.preparing}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-3 py-6 animate-fade-in-up">
            <div className="relative">
              <CheckCircle size={52} className="text-emerald-400" strokeWidth={1.5} />
              <span className="absolute inset-0 rounded-full border-2 border-emerald-400/40 animate-pulse-ring" />
            </div>
            <p className="text-base font-bold text-emerald-400">{t.success}</p>
            <p className="text-xs text-slate-500 text-center leading-relaxed max-w-xs">{t.note}</p>
            {downloadFile && (
              <button
                onClick={downloadExportFile}
                className="mt-2 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all active:scale-[0.97] shadow-lg shadow-emerald-500/20"
              >
                <Download size={15} strokeWidth={2} />
                {t.download}
              </button>
            )}
            {exportError && (
              <div className="mt-2 w-full bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                <p className="text-xs font-bold text-amber-400">{t.exportFailed}</p>
                <p className="text-[11px] text-slate-500 mt-1 break-words">{exportError}</p>
              </div>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="animate-fade-in-up space-y-4">
            {/* Error card */}
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <XCircle size={18} className="text-red-400" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-red-400">{t.error}</p>
                  <p className="text-xs text-slate-400 mt-1 break-words">{errorMsg}</p>
                </div>
              </div>
            </div>

            {/* Retry */}
            <button
              onClick={() => { setStatus('idle'); setErrorMsg('') }}
              className="w-full bg-[#22253a] hover:bg-[#2a2d3a] border border-[#2a2d3a] text-slate-300 font-semibold text-sm py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 4v6h6M23 20v-6h-6"/>
                <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/>
              </svg>
              {t.retry}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
