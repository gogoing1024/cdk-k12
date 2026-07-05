import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, KeyRound, Server, LogOut, Activity } from 'lucide-react'
import CDKKeyManager from './CDKKeyManager'
import WorkspaceManager from './WorkspaceManager'
import { getCDKKeys, getWorkspaces, logoutAdmin } from './db'

interface AdminDashboardProps {
  lang: 'zh' | 'en'
  onLogout: () => void
}

type Tab = 'keys' | 'workspaces'

export default function AdminDashboard({ lang, onLogout }: AdminDashboardProps) {
  const [tab, setTab] = useState<Tab>('keys')
  const [stats, setStats] = useState({ keys: 0, live: 0, used: 0, workspaces: 0, disabled: 0 })

  const refresh = useCallback(async (force = false) => {
    const [keys, workspaces] = await Promise.all([getCDKKeys(force), getWorkspaces(force)])
    setStats({
      keys: keys.length,
      live: keys.filter(k => k.status === 'live').length,
      used: keys.filter(k => k.status === 'used').length,
      workspaces: workspaces.length,
      disabled: keys.filter(k => k.status === 'disabled').length,
    })
  }, [])

  useEffect(() => {
    // Initial mount: force fresh data
    refresh(true)
  }, [refresh])

  const labels = {
    zh: {
      title: 'Admin Dashboard',
      subtitle: 'CDK K12 管理系统',
      tabKeys: 'Key 管理',
      tabWorkspaces: 'Workspace 管理',
      logout: '退出登录',
      totalKeys: 'Key 总数',
      liveKeys: '未使用',
      usedKeys: '已使用',
      disabledKeys: '已禁用',
      workspaces: 'Workspaces',
    },
    en: {
      title: 'Admin Dashboard',
      subtitle: 'CDK K12 Management System',
      tabKeys: 'Key Management',
      tabWorkspaces: 'Workspace Management',
      logout: 'Logout',
      totalKeys: 'Total Keys',
      liveKeys: 'Live Keys',
      usedKeys: 'Used Keys',
      disabledKeys: 'Disabled Keys',
      workspaces: 'Workspaces',
    },
  }
  const t = labels[lang]

  return (
    <div className="min-h-screen bg-[#0f1117]">
      {/* Header */}
      <header className="bg-[#1a1d27] border-b border-[#2a2d3a] sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                <ShieldCheck size={18} className="text-indigo-400" strokeWidth={1.5} />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-100">{t.title}</h1>
                <p className="text-[10px] text-slate-500">{t.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Stats bar */}
              <div className="hidden sm:flex items-center gap-2 mr-2">
                <div className="flex items-center gap-1.5 bg-[#22253a] rounded-lg px-2.5 py-1.5">
                  <KeyRound size={12} className="text-slate-500" strokeWidth={1.5} />
                  <span className="text-[11px] font-semibold text-slate-300">{stats.keys}</span>
                  <span className="text-[10px] text-slate-600">{t.totalKeys}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-500/10 rounded-lg px-2.5 py-1.5">
                  <Activity size={12} className="text-emerald-400" strokeWidth={1.5} />
                  <span className="text-[11px] font-semibold text-emerald-400">{stats.live}</span>
                  <span className="text-[10px] text-emerald-400/60">{t.liveKeys}</span>
                </div>
              </div>

              <button
                onClick={async () => {
                  await logoutAdmin()
                  onLogout()
                }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#22253a] border border-[#2a2d3a] text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all"
              >
                <LogOut size={14} strokeWidth={1.5} />
                <span className="hidden sm:inline">{t.logout}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-[#1a1d27] rounded-xl p-1 mb-6 w-fit">
          <button
            onClick={() => setTab('keys')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === 'keys'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound size={14} strokeWidth={1.5} />
            {t.tabKeys}
          </button>
          <button
            onClick={() => setTab('workspaces')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === 'workspaces'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server size={14} strokeWidth={1.5} />
            {t.tabWorkspaces}
          </button>
        </div>

        {/* Tab content - keep both mounted to preserve state and avoid remount on tab switch */}
        <div style={{ display: tab === 'keys' ? 'block' : 'none' }}>
          <CDKKeyManager lang={lang} onKeysChanged={refresh} />
        </div>
        <div style={{ display: tab === 'workspaces' ? 'block' : 'none' }}>
          <WorkspaceManager lang={lang} onWorkspacesChanged={refresh} />
        </div>
      </main>
    </div>
  )
}
