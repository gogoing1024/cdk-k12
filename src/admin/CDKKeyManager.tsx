import { useState, useEffect, useCallback } from 'react'
import {
  KeyRound, Plus, Copy, Check, Trash2, Search, X,
  ToggleLeft, ToggleRight, Loader2,
} from 'lucide-react'
import { CDKKey, STATUS_LABELS, formatDate } from './types'
import {
  getCDKKeys, addCDKKey, updateCDKKey, deleteCDKKey,
  getWorkspaces,
} from './db'

interface CDKKeyManagerProps {
  lang: 'vi' | 'en'
  onKeysChanged?: () => void
}

type TabFilter = 'all' | 'live' | 'used' | 'disabled'

export default function CDKKeyManager({ lang, onKeysChanged }: CDKKeyManagerProps) {
  const [keys, setKeys] = useState<CDKKey[]>([])
  const [workspaces, setWorkspaces] = useState<{ id: string; workspaceId: string; name: string }[]>([])
  const [tab, setTab] = useState<TabFilter>('all')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState<'single' | 'bulk' | null>(null)
  const [newKeyKey, setNewKeyKey] = useState('')
  const [newKeyWs, setNewKeyWs] = useState('')
  const [bulkInput, setBulkInput] = useState('')
  const [bulkWsId, setBulkWsId] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkResults, setBulkResults] = useState<{ key: string; found: boolean; status: string; email?: string }[]>([])
  const [bulkSearching, setBulkSearching] = useState(false)

  const loadData = useCallback(async () => {
    const [k, w] = await Promise.all([getCDKKeys(), getWorkspaces()])
    setKeys(k)
    const wsList = w.map(({ id, workspaceId, name }) => ({ id, workspaceId, name }))
    setWorkspaces(wsList)
    const defaultWs = wsList.find(x => x.name === 'Default Workspace') || wsList[0]
    if (defaultWs) {
      setNewKeyWs(prev => prev || defaultWs.workspaceId)
      setBulkWsId(prev => prev || defaultWs.workspaceId)
    }
    onKeysChanged?.()
  }, [onKeysChanged])

  useEffect(() => {
    loadData()
  }, [loadData])

  function openCreateModal() {
    setCreateError('')
    setCreateSuccess('')
    if (workspaces.length > 0) {
      const defaultWs = workspaces.find(x => x.name === 'Default Workspace') || workspaces[0]
      setNewKeyWs(defaultWs.workspaceId)
      setBulkWsId(defaultWs.workspaceId)
    }
    setShowCreate('single')
  }

  const filtered = keys.filter(k => {
    const matchSearch = search === '' ||
      k.key.toLowerCase().includes(search.toLowerCase()) ||
      (k.activatedEmail || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = tab === 'all' || k.status === tab
    return matchSearch && matchFilter
  })

  function copyKey(key: string, id: string) {
    navigator.clipboard.writeText(key).catch(() => {})
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  async function handleCreateSingle() {
    if (!newKeyKey.trim() || !newKeyWs.trim()) {
      setCreateError(lang === 'vi' ? 'Vui lòng nhập key và chọn workspace' : 'Please enter key and pick workspace')
      return
    }
    setCreating(true)
    setCreateError('')
    setCreateSuccess('')
    const record: CDKKey = {
      id: crypto.randomUUID(),
      key: newKeyKey.trim().toUpperCase(),
      workspaceId: newKeyWs.trim(),
      status: 'live',
      createdAt: Date.now(),
    }
    try {
      await addCDKKey(record)
      await loadData()
      setNewKeyKey('')
      setNewKeyWs('')
      setCreateSuccess(lang === 'vi' ? `Đã tạo key ${record.key}` : `Created key ${record.key}`)
      setTimeout(() => {
        setShowCreate(null)
        setCreateSuccess('')
      }, 900)
    } catch (err: any) {
      setCreateError(err?.message || (lang === 'vi' ? 'Tạo key thất bại' : 'Failed to create key'))
    } finally {
      setCreating(false)
    }
  }

  async function handleCreateBulk() {
    const lines = bulkInput.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0 || !bulkWsId.trim()) {
      setCreateError(lang === 'vi' ? 'Vui lòng nhập danh sách key và chọn workspace' : 'Please paste keys and pick workspace')
      return
    }
    setCreating(true)
    setCreateError('')
    setCreateSuccess('')
    let success = 0
    let failed: string[] = []
    for (const line of lines) {
      const record: CDKKey = {
        id: crypto.randomUUID(),
        key: line.toUpperCase(),
        workspaceId: bulkWsId.trim(),
        status: 'live',
        createdAt: Date.now(),
      }
      try {
        await addCDKKey(record)
        success++
      } catch (err: any) {
        failed.push(`${line} (${err?.message || 'error'})`)
      }
    }
    try {
      await loadData()
    } catch (err: any) {
      setCreateError(err?.message || (lang === 'vi' ? 'Lỗi tải lại danh sách' : 'Failed to reload list'))
    }
    if (failed.length === 0) {
      setBulkInput('')
      setBulkWsId('')
      setCreateSuccess(lang === 'vi' ? `Đã tạo ${success} key` : `Created ${success} keys`)
      setTimeout(() => {
        setShowCreate(null)
        setCreateSuccess('')
      }, 900)
    } else if (success > 0) {
      setCreateError(
        (lang === 'vi' ? `Tạo ${success} key thành công, ${failed.length} lỗi: ` : `Created ${success}, ${failed.length} failed: `) +
        failed.slice(0, 3).join('; ') + (failed.length > 3 ? '…' : '')
      )
    } else {
      setCreateError(
        (lang === 'vi' ? `Tạo thất bại: ` : `All failed: `) + failed.slice(0, 3).join('; ')
      )
    }
    setCreating(false)
  }

  async function handleDelete(id: string) {
    await deleteCDKKey(id)
    await loadData()
    setShowDeleteConfirm(null)
  }

  async function handleToggleStatus(key: CDKKey) {
    const next = key.status === 'live' ? 'disabled' : 'live'
    await updateCDKKey(key.id, { status: next })
    await loadData()
  }

  async function handleBulkCheck() {
    const lines = bulkInput.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    setBulkSearching(true)
    setBulkResults([])
    await new Promise(r => setTimeout(r, 200))
    const results = lines.map(line => {
      const found = keys.find(k => k.key.toLowerCase() === line.toLowerCase())
      return {
        key: line,
        found: !!found,
        status: found ? found.status : 'not_found',
        email: found?.activatedEmail,
      }
    })
    setBulkResults(results)
    setBulkSearching(false)
  }

  const stats = {
    total: keys.length,
    live: keys.filter(k => k.status === 'live').length,
    used: keys.filter(k => k.status === 'used').length,
    disabled: keys.filter(k => k.status === 'disabled').length,
  }

  const labels = {
    vi: {
      title: 'Quản lý CDK Keys',
      tabAll: 'Tất cả',
      tabLive: 'Chưa dùng',
      tabUsed: 'Đã dùng',
      tabDisabled: 'Vô hiệu',
      search: 'Tìm kiếm key hoặc email...',
      create: 'Tạo Key mới',
      createTitle: 'Tạo CDK Key',
      createSingle: 'Tạo đơn',
      createBulk: 'Tạo hàng loạt',
      keyLabel: 'CDK Key',
      wsLabel: 'Workspace ID',
      keyPlaceholder: 'VD: ABCD-1234-EFGH',
      bulkPlaceholder: 'Mỗi dòng 1 key',
      createBtn: 'Tạo ngay',
      cancel: 'Hủy',
      delete: 'Xóa',
      copied: 'Đã sao chép!',
      copy: 'Sao chép',
      disable: 'Vô hiệu hóa',
      enable: 'Kích hoạt lại',
      noKeys: 'Chưa có key nào.',
      noWorkspaces: 'Chưa có workspace nào — vào tab Workspaces để tạo',
      keyCol: 'CDK Key',
      wsCol: 'Workspace ID',
      statusCol: 'Trạng thái',
      createdCol: 'Ngày tạo',
      emailCol: 'Email',
      actionsCol: 'Hành động',
      notUsed: '—',
      bulkCheck: 'Kiểm tra hàng loạt',
      checkResult: 'Kết quả kiểm tra',
      bulkInput: 'Dán danh sách key (mỗi dòng 1 key)',
      check: 'Kiểm tra',
      clearResults: 'Xóa kết quả',
      notFound: 'Không tìm thấy',
      selectWs: 'Chọn Workspace',
      createdOk: 'Đã tạo',
    },
    en: {
      title: 'CDK Key Management',
      tabAll: 'All',
      tabLive: 'Live',
      tabUsed: 'Used',
      tabDisabled: 'Disabled',
      search: 'Search key or email...',
      create: 'Create New Key',
      createTitle: 'Create CDK Key',
      createSingle: 'Create Single',
      createBulk: 'Create Bulk',
      keyLabel: 'CDK Key',
      wsLabel: 'Workspace ID',
      keyPlaceholder: 'e.g. ABCD-1234-EFGH',
      bulkPlaceholder: 'One key per line',
      createBtn: 'Create Now',
      cancel: 'Cancel',
      delete: 'Delete',
      copied: 'Copied!',
      copy: 'Copy',
      disable: 'Disable',
      enable: 'Enable',
      noKeys: 'No keys yet.',
      noWorkspaces: 'No workspaces — go to Workspaces tab to create one',
      keyCol: 'CDK Key',
      wsCol: 'Workspace ID',
      statusCol: 'Status',
      createdCol: 'Created',
      emailCol: 'Email',
      actionsCol: 'Actions',
      notUsed: '—',
      bulkCheck: 'Bulk Check',
      checkResult: 'Check Results',
      bulkInput: 'Paste key list (one per line)',
      check: 'Check',
      clearResults: 'Clear results',
      notFound: 'Not found',
      selectWs: 'Select Workspace',
      createdOk: 'Created',
    },
  }
  const t = labels[lang]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-indigo-400" strokeWidth={1.5} />
          <h2 className="text-sm font-bold text-slate-100">{t.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setBulkMode(!bulkMode); setBulkResults([]) }}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
              bulkMode
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                : 'bg-[#22253a] border-[#2a2d3a] text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.bulkCheck}
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white transition-all"
          >
            <Plus size={14} strokeWidth={2} />
            {t.create}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: t.tabAll, count: stats.total, color: 'bg-slate-500/15 text-slate-400' },
          { label: t.tabLive, count: stats.live, color: 'bg-emerald-500/15 text-emerald-400' },
          { label: t.tabUsed, count: stats.used, color: 'bg-slate-500/15 text-slate-400' },
          { label: t.tabDisabled, count: stats.disabled, color: 'bg-red-500/15 text-red-400' },
        ].map(s => (
          <div key={s.label} className={`rounded-lg px-3 py-2 ${s.color}`}>
            <p className="text-xs font-bold">{s.count}</p>
            <p className="text-[10px] opacity-70 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Bulk Check Mode */}
      {bulkMode && (
        <div className="bg-[#22253a] border border-[#2a2d3a] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-300">{t.bulkInput}</p>
            <button
              onClick={handleBulkCheck}
              disabled={bulkSearching || !bulkInput.trim()}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkSearching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              {t.check}
            </button>
          </div>
          <textarea
            value={bulkInput}
            onChange={e => setBulkInput(e.target.value)}
            placeholder={t.bulkPlaceholder}
            className="w-full h-24 bg-[#1a1d27] border border-[#2a2d3a] rounded-lg px-3 py-2 text-xs font-mono text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500/50"
          />

          {bulkResults.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300">{t.checkResult} ({bulkResults.length})</p>
                <button onClick={() => setBulkResults([])} className="text-xs text-slate-500 hover:text-slate-300">
                  {t.clearResults}
                </button>
              </div>
              {bulkResults.map((r, i) => (
                <div key={i} className="flex items-center justify-between bg-[#1a1d27] rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    {r.status === 'live' && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                    {r.status === 'used' && <div className="w-2 h-2 rounded-full bg-slate-500" />}
                    {r.status === 'disabled' && <div className="w-2 h-2 rounded-full bg-red-400" />}
                    {r.status === 'not_found' && <div className="w-2 h-2 rounded-full bg-yellow-400" />}
                    <span className="text-xs font-mono text-slate-300">{r.key}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status !== 'not_found' && r.email && (
                      <span className="text-[10px] text-slate-500">{r.email}</span>
                    )}
                    <span className={`text-[10px] font-semibold ${
                      r.status === 'live' ? 'text-emerald-400' :
                      r.status === 'used' ? 'text-slate-400' :
                      r.status === 'disabled' ? 'text-red-400' :
                      'text-yellow-400'
                    }`}>
                      {r.status === 'not_found' ? t.notFound : STATUS_LABELS[r.status as keyof typeof STATUS_LABELS]?.[lang === 'vi' ? 'vi' : 'en']}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search & Tabs */}
      {!bulkMode && (
        <>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={1.5} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.search}
              className="w-full bg-[#22253a] border border-[#2a2d3a] rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                <X size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-[#22253a] rounded-xl p-1">
            {(['all', 'live', 'used', 'disabled'] as TabFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setTab(f)}
                className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-all ${
                  tab === f ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f === 'all' ? t.tabAll : f === 'live' ? t.tabLive : f === 'used' ? t.tabUsed : t.tabDisabled}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Table */}
      {!bulkMode && (
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">{t.noKeys}</div>
          ) : (
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                <div className="col-span-2">{t.keyCol}</div>
                <div className="col-span-3">{t.wsCol}</div>
                <div className="col-span-2">{t.statusCol}</div>
                <div className="col-span-2">{t.createdCol}</div>
                <div className="col-span-2">{t.emailCol}</div>
                <div className="col-span-1" />
              </div>

              {/* Rows */}
              {filtered.map(key => (
                <div
                  key={key.id}
                  className="grid grid-cols-12 gap-2 items-center px-3 py-2.5 bg-[#1a1d27] rounded-lg hover:bg-[#22253a] transition-colors group"
                >
                  {/* Key */}
                  <div className="col-span-2 flex items-center gap-1.5">
                    <span className="text-xs font-mono font-semibold text-indigo-300 truncate">{key.key}</span>
                    <button
                      onClick={() => copyKey(key.key, key.id)}
                      className="text-slate-600 hover:text-indigo-400 transition-colors flex-shrink-0"
                      title={t.copy}
                    >
                      {copiedId === key.id ? (
                        <Check size={12} className="text-emerald-400" strokeWidth={2} />
                      ) : (
                        <Copy size={12} strokeWidth={1.5} />
                      )}
                    </button>
                  </div>

                  {/* Workspace ID */}
                  <div className="col-span-3">
                    <span className="text-[11px] font-mono text-slate-500 truncate block">{key.workspaceId}</span>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <span className={`text-xs font-semibold ${STATUS_LABELS[key.status].color}`}>
                      {STATUS_LABELS[key.status].vi}
                    </span>
                  </div>

                  {/* Created */}
                  <div className="col-span-2">
                    <span className="text-[11px] text-slate-500">{formatDate(key.createdAt)}</span>
                  </div>

                  {/* Email */}
                  <div className="col-span-2">
                    <span className="text-[11px] text-slate-400 truncate block">
                      {key.activatedEmail || t.notUsed}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex items-center justify-end gap-1">
                    {key.status !== 'used' && (
                      <button
                        onClick={() => handleToggleStatus(key)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                        title={key.status === 'live' ? t.disable : t.enable}
                      >
                        {key.status === 'live' ? (
                          <ToggleRight size={16} strokeWidth={1.5} />
                        ) : (
                          <ToggleLeft size={16} strokeWidth={1.5} />
                        )}
                      </button>
                    )}
                    {showDeleteConfirm === key.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(key.id)}
                          className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-all"
                        >
                          <Check size={14} strokeWidth={2} />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-500/10 transition-all"
                        >
                          <X size={14} strokeWidth={2} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDeleteConfirm(key.id)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                        title={t.delete}
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-slate-100">{t.createTitle}</h3>
              <button onClick={() => { setShowCreate(null); setCreateError(''); setCreateSuccess('') }} className="text-slate-500 hover:text-slate-300">
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setShowCreate('single')}
                className={`flex-1 text-xs py-2 rounded-lg font-medium transition-all ${
                  showCreate === 'single' ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300' : 'bg-[#22253a] border border-[#2a2d3a] text-slate-400'
                }`}
              >
                {t.createSingle}
              </button>
              <button
                onClick={() => setShowCreate('bulk')}
                className={`flex-1 text-xs py-2 rounded-lg font-medium transition-all ${
                  showCreate === 'bulk' ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300' : 'bg-[#22253a] border border-[#2a2d3a] text-slate-400'
                }`}
              >
                {t.createBulk}
              </button>
            </div>

            {showCreate === 'single' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">{t.keyLabel}</label>
                  <input
                    type="text"
                    value={newKeyKey}
                    onChange={e => setNewKeyKey(e.target.value.toUpperCase())}
                    placeholder={t.keyPlaceholder}
                    className="w-full bg-[#22253a] border border-[#2a2d3a] rounded-xl px-4 py-3 text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">{t.wsLabel}</label>
                  <select
                    value={newKeyWs}
                    onChange={e => setNewKeyWs(e.target.value)}
                    className="w-full bg-[#22253a] border border-[#2a2d3a] rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer"
                  >
                    {workspaces.length === 0 ? (
                      <option value="">{t.noWorkspaces}</option>
                    ) : (
                      <>
                        {!newKeyWs && <option value="">{t.selectWs}</option>}
                        {workspaces.map(w => (
                          <option key={w.id} value={w.workspaceId}>{w.name} — {w.workspaceId.slice(0, 8)}...</option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
                <button
                  onClick={handleCreateSingle}
                  disabled={!newKeyKey.trim() || !newKeyWs.trim() || creating}
                  className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {t.createBtn}
                </button>
                {createError && (
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-300">
                    <X size={14} className="flex-shrink-0 mt-0.5" strokeWidth={2} />
                    <span>{createError}</span>
                  </div>
                )}
                {createSuccess && !createError && (
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-emerald-300">
                    <Check size={14} strokeWidth={2} />
                    <span>{createSuccess}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">{t.wsLabel}</label>
                  <select
                    value={bulkWsId}
                    onChange={e => setBulkWsId(e.target.value)}
                    className="w-full bg-[#22253a] border border-[#2a2d3a] rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer mb-3"
                  >
                    {workspaces.length === 0 ? (
                      <option value="">{t.noWorkspaces}</option>
                    ) : (
                      <>
                        {!bulkWsId && <option value="">{t.selectWs}</option>}
                        {workspaces.map(w => (
                          <option key={w.id} value={w.workspaceId}>{w.name} — {w.workspaceId.slice(0, 8)}...</option>
                        ))}
                      </>
                    )}
                  </select>
                  <label className="block text-xs text-slate-500 mb-1.5">{t.bulkPlaceholder}</label>
                  <textarea
                    value={bulkInput}
                    onChange={e => setBulkInput(e.target.value)}
                    placeholder={`ABCD-1234-EFGH\nMNOP-5678-IJKL\nQRST-9012-UVWX`}
                    className="w-full h-32 bg-[#22253a] border border-[#2a2d3a] rounded-xl px-4 py-3 text-sm font-mono text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <button
                  onClick={handleCreateBulk}
                  disabled={!bulkInput.trim() || !bulkWsId.trim() || creating}
                  className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {t.createBtn} ({bulkInput.split('\n').filter(Boolean).length})
                </button>
                {createError && (
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-300">
                    <X size={14} className="flex-shrink-0 mt-0.5" strokeWidth={2} />
                    <span>{createError}</span>
                  </div>
                )}
                {createSuccess && !createError && (
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-emerald-300">
                    <Check size={14} strokeWidth={2} />
                    <span>{createSuccess}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
