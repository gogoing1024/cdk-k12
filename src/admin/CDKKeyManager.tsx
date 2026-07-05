import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  KeyRound, Plus, Copy, Check, Trash2, Search, X,
  ToggleLeft, ToggleRight, Loader2, ArrowRightLeft, ChevronDown,
} from 'lucide-react'
import { CDKKey, STATUS_LABELS, formatDate } from './types'
import {
  getCDKKeys, addCDKKey, updateCDKKey, deleteCDKKey,
  getWorkspaces,
} from './db'
import { formatWorkspaceLabel, type WorkspaceOption } from './workspaceSelect'
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  clampPage,
  getPageCount,
  getPageItems,
  getPageRange,
  prependItems,
  removeItemsById,
} from './cdkListState'

interface CDKKeyManagerProps {
  lang: 'zh' | 'en'
  onKeysChanged?: () => void
}

type TabFilter = 'all' | 'live' | 'used' | 'disabled'

interface WorkspaceSelectProps {
  value: string
  onChange: (value: string) => void
  workspaces: WorkspaceOption[]
  placeholder: string
  emptyLabel: string
  disabled?: boolean
  className?: string
}

function WorkspaceSelect({
  value,
  onChange,
  workspaces,
  placeholder,
  emptyLabel,
  disabled = false,
  className = '',
}: WorkspaceSelectProps) {
  const [open, setOpen] = useState(false)
  const selected = workspaces.find(workspace => workspace.workspaceId === value)
  const label = selected ? formatWorkspaceLabel(selected) : placeholder
  const isDisabled = disabled || workspaces.length === 0

  function pickWorkspace(workspaceId: string) {
    onChange(workspaceId)
    setOpen(false)
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !isDisabled && setOpen(prev => !prev)}
        disabled={isDisabled}
        className={`w-full bg-[#22253a] border rounded-xl px-4 py-3 text-sm text-left transition-all flex items-center justify-between gap-3 ${
          open
            ? 'border-indigo-500/50 ring-2 ring-indigo-500/10'
            : 'border-[#2a2d3a] hover:border-indigo-500/30'
        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${selected ? 'text-slate-200' : 'text-slate-500'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{workspaces.length === 0 ? emptyLabel : label}</span>
        <ChevronDown
          size={16}
          strokeWidth={1.8}
          className={`flex-shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180 text-indigo-300' : ''}`}
        />
      </button>

      {open && !isDisabled && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            aria-label="Close workspace menu"
          />
          <div
            className="absolute left-0 right-0 top-full z-20 mt-2 max-h-56 overflow-y-auto rounded-xl border border-[#34384a] bg-[#151822] p-2 shadow-2xl shadow-black/40 space-y-1"
            role="listbox"
          >
            {workspaces.map(workspace => {
              const selectedItem = workspace.workspaceId === value
              return (
                <button
                  key={workspace.id || workspace.workspaceId}
                  type="button"
                  onClick={() => pickWorkspace(workspace.workspaceId)}
                  className={`w-full rounded-lg px-3.5 py-3 text-left transition-colors flex items-center gap-3 ${
                    selectedItem
                      ? 'bg-indigo-500/20 text-indigo-100'
                      : 'text-slate-300 hover:bg-[#22253a]'
                  }`}
                  role="option"
                  aria-selected={selectedItem}
                >
                  <span className={`w-5 flex-shrink-0 flex justify-center ${selectedItem ? 'text-indigo-300' : 'text-transparent'}`}>
                    <Check size={14} strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0 space-y-1">
                    <span className="block truncate text-sm font-medium leading-snug">{workspace.name || workspace.workspaceId.slice(0, 8)}</span>
                    <span className="block truncate text-[11px] font-mono leading-tight text-slate-500">{workspace.workspaceId}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function CDKKeyManager({ lang, onKeysChanged }: CDKKeyManagerProps) {
  const [keys, setKeys] = useState<CDKKey[]>([])
  const [workspaces, setWorkspaces] = useState<{ id: string; workspaceId: string; name: string }[]>([])
  const [tab, setTab] = useState<TabFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [showCreate, setShowCreate] = useState<'single' | 'bulk' | null>(null)
  const [newKeyKey, setNewKeyKey] = useState('')
  const [newKeyWs, setNewKeyWs] = useState('')
  const [bulkInput, setBulkInput] = useState('')
  const [bulkWsId, setBulkWsId] = useState('')
  const [creating, setCreating] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 })
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkResults, setBulkResults] = useState<{ key: string; id?: string; found: boolean; status: string; email?: string }[]>([])
  const [bulkSearching, setBulkSearching] = useState(false)
  const [bulkDisabling, setBulkDisabling] = useState(false)
  const [bulkDisableProgress, setBulkDisableProgress] = useState({ current: 0, total: 0 })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState({ current: 0, total: 0 })
  const [showMove, setShowMove] = useState(false)
  const [moveTargetWs, setMoveTargetWs] = useState('')
  const [moving, setMoving] = useState(false)
  const [moveProgress, setMoveProgress] = useState({ current: 0, total: 0 })
  const [moveError, setMoveError] = useState('')
  const [moveSuccess, setMoveSuccess] = useState('')

  const loadData = useCallback(async (force = false) => {
    const [k, w] = await Promise.all([getCDKKeys(force), getWorkspaces(force)])
    setKeys(k)
    const wsList = w.map(({ id, workspaceId, name }) => ({ id, workspaceId, name }))
    setWorkspaces(wsList)
    const defaultWs = wsList.find(x => x.name === 'Default Workspace') || wsList[0]
    if (defaultWs) {
      setNewKeyWs(prev => prev || defaultWs.workspaceId)
      setBulkWsId(prev => prev || defaultWs.workspaceId)
    }
  }, [])

  useEffect(() => {
    // Initial mount: force fresh data
    loadData(true)
    // Refresh keys when the tab regains focus (covers F5-from-different-tab,
    // or keys added/removed by another admin/browser session).
    const onFocus = () => loadData(true)
    const onVis = () => { if (!document.hidden) loadData(true) }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [loadData])

  function openCreateModal() {
    setCreateError('')
    setCreateSuccess('')
    if (workspaces.length > 0) {
      const defaultWs = workspaces.find(x => x.name === 'Default Workspace') || workspaces[0]
      // Only pre-fill if user hasn't picked one yet, so their previous choice is preserved
      setNewKeyWs(prev => prev || defaultWs.workspaceId)
      setBulkWsId(prev => prev || defaultWs.workspaceId)
    }
    setShowCreate('single')
  }

  const filtered = useMemo(() => keys.filter(k => {
    const matchSearch = search === '' ||
      k.key.toLowerCase().includes(search.toLowerCase()) ||
      (k.activatedEmail || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = tab === 'all' || k.status === tab
    return matchSearch && matchFilter
  }), [keys, search, tab])

  useEffect(() => {
    setPage(1)
  }, [search, tab, pageSize])

  useEffect(() => {
    setPage(prev => clampPage(prev, filtered.length, pageSize))
  }, [filtered.length, pageSize])

  function copyKey(key: string, id: string) {
    navigator.clipboard.writeText(key).catch(() => {})
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  async function handleCreateSingle() {
    if (!newKeyKey.trim() || !newKeyWs.trim()) {
      setCreateError(lang === 'zh' ? '请输入 key 并选择 workspace' : 'Please enter key and pick workspace')
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
      // Cache already updated by addCDKKey — just reflect locally.
      // Wrap in requestAnimationFrame so the modal can close smoothly first.
      requestAnimationFrame(() => {
        setKeys(prev => [record, ...prev])
      })
      setNewKeyKey('')
      setNewKeyWs('')
      setCreateSuccess(lang === 'zh' ? `已创建 key ${record.key}` : `Created key ${record.key}`)
      setTimeout(() => {
        setShowCreate(null)
        setCreateSuccess('')
      }, 900)
      onKeysChanged?.()
    } catch (err: any) {
      setCreateError(err?.message || (lang === 'zh' ? '创建 key 失败' : 'Failed to create key'))
    } finally {
      setCreating(false)
    }
  }

  async function handleCreateBulk() {
    const lines = bulkInput.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0 || !bulkWsId.trim()) {
      setCreateError(lang === 'zh' ? '请输入 key 列表并选择 workspace' : 'Please paste keys and pick workspace')
      return
    }
    setCreating(true)
    setCreateError('')
    setCreateSuccess('')
    setBulkProgress({ current: 0, total: lines.length })

    const wsId = bulkWsId.trim()
    const successRecords: CDKKey[] = []
    const failed: string[] = []

    // Run sequentially with a short delay so Upstash rate limits aren't tripped.
    // Keep list structure stable during the batch; insert successful records once at the end.
    for (let i = 0; i < lines.length; i++) {
      const rec: CDKKey = {
        id: crypto.randomUUID(),
        key: lines[i].toUpperCase(),
        workspaceId: wsId,
        status: 'live' as const,
        createdAt: Date.now(),
      }
      try {
        await addCDKKey(rec)
        successRecords.push(rec)
      } catch (err: any) {
        failed.push(`${rec.key} (${err?.message || 'error'})`)
      }
      setBulkProgress({ current: i + 1, total: lines.length })
      // Small breather between calls so Upstash can keep up with bursts of writes
      if (i < lines.length - 1) await new Promise(r => setTimeout(r, 40))
    }

    if (failed.length === 0) {
      setKeys(prev => prependItems(prev, [...successRecords].reverse()))
      setBulkInput('')
      setBulkWsId('')
      setCreateSuccess(lang === 'zh' ? `已创建 ${successRecords.length} 个 key` : `Created ${successRecords.length} keys`)
      setTimeout(() => {
        setShowCreate(null)
        setCreateSuccess('')
      }, 1200)
      onKeysChanged?.()
    } else if (successRecords.length > 0) {
      setCreateError(
        (lang === 'zh' ? `成功创建 ${successRecords.length} 个，${failed.length} 个失败：` : `Created ${successRecords.length}, ${failed.length} failed: `) +
        failed.slice(0, 3).join('; ') + (failed.length > 3 ? '…' : '')
      )
      setKeys(prev => prependItems(prev, [...successRecords].reverse()))
      onKeysChanged?.()
    } else {
      setCreateError(
        (lang === 'zh' ? `创建失败：` : `All failed: `) + failed.slice(0, 3).join('; ')
      )
    }
    setCreating(false)
    setBulkProgress({ current: 0, total: 0 })
  }

  async function handleDelete(id: string) {
    await deleteCDKKey(id)
    // Cache already updated by deleteCDKKey
    setKeys(prev => prev.filter(k => k.id !== id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setShowDeleteConfirm(null)
    onKeysChanged?.()
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectCurrentPage() {
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (const key of pagedKeys) next.add(key.id)
      return next
    })
  }

  function clearCurrentPageSelection() {
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (const key of pagedKeys) next.delete(key.id)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function openMoveModal() {
    if (selectedIds.size === 0) return
    const liveCount = keys.filter(k => selectedIds.has(k.id) && k.status === 'live').length
    if (liveCount === 0) {
      setMoveError(lang === 'zh' ? '只能移动未激活的 key（status=live）' : 'Only unactivated keys (status=live) can be moved')
      return
    }
    setMoveError('')
    setMoveSuccess('')
    setMoveTargetWs(prev => prev || workspaces.find(w => w.name === 'Default Workspace')?.workspaceId || workspaces[0]?.workspaceId || '')
    setShowMove(true)
  }

  async function handleMove() {
    if (!moveTargetWs.trim()) {
      setMoveError(lang === 'zh' ? '请选择目标 workspace' : 'Please pick a target workspace')
      return
    }
    // Only move keys that are still 'live' — used/disabled keys are locked
    const targets = keys.filter(k => selectedIds.has(k.id) && k.status === 'live')
    if (targets.length === 0) {
      setMoveError(lang === 'zh' ? '没有可移动的 key（已使用或已禁用）' : 'No movable keys remain (already used or disabled)')
      return
    }
    setMoving(true)
    setMoveError('')
    setMoveSuccess('')
    setMoveProgress({ current: 0, total: targets.length })

    const wsId = moveTargetWs.trim()
    const moved: CDKKey[] = []
    const failed: string[] = []

    // Sequential to stay under Upstash rate limits, update UI per item.
    for (let i = 0; i < targets.length; i++) {
      const k = targets[i]
      try {
        const updated = await updateCDKKey(k.id, { workspaceId: wsId })
        moved.push(updated)
        setKeys(prev => prev.map(x => x.id === k.id ? { ...x, workspaceId: wsId } : x))
      } catch (err: any) {
        failed.push(`${k.key} (${err?.message || 'error'})`)
      }
      setMoveProgress({ current: i + 1, total: targets.length })
      if (i < targets.length - 1) await new Promise(r => setTimeout(r, 40))
    }

    if (failed.length === 0) {
      setMoveSuccess(lang === 'zh' ? `已将 ${moved.length} 个 key 移动到新 workspace` : `Moved ${moved.length} keys to the new workspace`)
      setSelectedIds(new Set())
      onKeysChanged?.()
      setTimeout(() => {
        setShowMove(false)
        setMoveSuccess('')
      }, 1500)
    } else if (moved.length > 0) {
      setMoveError(
        (lang === 'zh' ? `成功移动 ${moved.length} 个，${failed.length} 个失败：` : `Moved ${moved.length}, ${failed.length} failed: `) +
        failed.slice(0, 3).join('; ') + (failed.length > 3 ? '…' : '')
      )
      onKeysChanged?.()
    } else {
      setMoveError(
        (lang === 'zh' ? `移动失败：` : `Move failed: `) + failed.slice(0, 3).join('; ')
      )
    }
    setMoving(false)
    setMoveProgress({ current: 0, total: 0 })
  }

  async function handleBulkDelete() {
    const targets = keys.filter(k => selectedIds.has(k.id))
    if (targets.length === 0) return

    if (!confirm(lang === 'zh'
      ? `永久删除已选择的 ${targets.length} 个 key？`
      : `Permanently delete ${targets.length} selected key(s)?`)) return

    setBulkDeleting(true)
    setBulkDeleteProgress({ current: 0, total: targets.length })

    const deletedIds: string[] = []
    const failed: string[] = []

    for (let i = 0; i < targets.length; i++) {
      const key = targets[i]
      try {
        await deleteCDKKey(key.id)
        deletedIds.push(key.id)
      } catch (err: any) {
        failed.push(`${key.key} (${err?.message || 'error'})`)
      }
      setBulkDeleteProgress({ current: i + 1, total: targets.length })
      if (i < targets.length - 1) await new Promise(r => setTimeout(r, 40))
    }

    if (failed.length === 0) {
      onKeysChanged?.()
    } else {
      alert((lang === 'zh' ? `已删除 ${deletedIds.length} 个，${failed.length} 个失败：` : `Deleted ${deletedIds.length}, ${failed.length} failed: `) +
        failed.slice(0, 5).join('; ') + (failed.length > 5 ? '…' : ''))
      onKeysChanged?.()
    }

    setKeys(prev => removeItemsById(prev, deletedIds))
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (const id of deletedIds) next.delete(id)
      return next
    })
    setShowDeleteConfirm(prev => prev && deletedIds.includes(prev) ? null : prev)
    setBulkDeleting(false)
    setBulkDeleteProgress({ current: 0, total: 0 })
  }

  async function handleToggleStatus(key: CDKKey) {
    const next = key.status === 'live' ? 'disabled' : 'live'
    await updateCDKKey(key.id, { status: next })
    // Cache already updated by updateCDKKey
    setKeys(prev => prev.map(k => k.id === key.id ? { ...k, status: next } : k))
    onKeysChanged?.()
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
        id: found?.id,
        found: !!found,
        status: found ? found.status : 'not_found',
        email: found?.activatedEmail,
      }
    })
    setBulkResults(results)
    setBulkSearching(false)
  }

  async function handleBulkDisable() {
    // Disable only entries we found AND that are still 'live'
    const targets = bulkResults.filter(r => r.found && r.status === 'live' && r.id)
    if (targets.length === 0) return

    if (!confirm(lang === 'zh'
      ? `禁用 ${targets.length} 个未使用的 key？`
      : `Disable ${targets.length} unactivated key(s)?`)) return

    setBulkDisabling(true)
    setBulkDisableProgress({ current: 0, total: targets.length })

    const disabledIds: string[] = []
    const failed: string[] = []

    // Sequential with a breather, same pattern as bulk create / move
    for (let i = 0; i < targets.length; i++) {
      const r = targets[i]
      try {
        await updateCDKKey(r.id!, { status: 'disabled' })
        disabledIds.push(r.id!)
        setKeys(prev => prev.map(x => x.id === r.id ? { ...x, status: 'disabled' as const } : x))
        // Update the result row live so the dot turns red without waiting for the whole batch
        setBulkResults(prev => prev.map(x => x.key.toLowerCase() === r.key.toLowerCase() && x.id === r.id
          ? { ...x, status: 'disabled' }
          : x))
      } catch (err: any) {
        failed.push(`${r.key} (${err?.message || 'error'})`)
      }
      setBulkDisableProgress({ current: i + 1, total: targets.length })
      if (i < targets.length - 1) await new Promise(r => setTimeout(r, 40))
    }

    if (failed.length === 0) {
      alert(lang === 'zh' ? `已禁用 ${disabledIds.length} 个 key` : `Disabled ${disabledIds.length} key(s)`)
    } else {
      alert((lang === 'zh' ? `已禁用 ${disabledIds.length} 个，${failed.length} 个失败：` : `Disabled ${disabledIds.length}, ${failed.length} failed: `) +
        failed.slice(0, 5).join('; ') + (failed.length > 5 ? '…' : ''))
    }
    onKeysChanged?.()
    setBulkDisabling(false)
    setBulkDisableProgress({ current: 0, total: 0 })
  }

  const stats = {
    total: keys.length,
    live: keys.filter(k => k.status === 'live').length,
    used: keys.filter(k => k.status === 'used').length,
    disabled: keys.filter(k => k.status === 'disabled').length,
  }
  const pageCount = getPageCount(filtered.length, pageSize)
  const currentPage = clampPage(page, filtered.length, pageSize)
  const pagedKeys = getPageItems(filtered, currentPage, pageSize)
  const pageRange = getPageRange(filtered.length, currentPage, pageSize)
  const selectedKeys = keys.filter(k => selectedIds.has(k.id))
  const selectedLiveCount = selectedKeys.filter(k => k.status === 'live').length
  const currentPageSelected = pagedKeys.length > 0 && pagedKeys.every(k => selectedIds.has(k.id))

  const labels = {
    zh: {
      title: 'CDK Key 管理',
      tabAll: '全部',
      tabLive: '未使用',
      tabUsed: '已使用',
      tabDisabled: '已禁用',
      search: '搜索 key 或邮箱...',
      create: '新建 Key',
      createTitle: '新建 CDK Key',
      createSingle: '单个创建',
      createBulk: '批量创建',
      keyLabel: 'CDK Key',
      wsLabel: 'Workspace ID',
      keyPlaceholder: '例如：ABCD-1234-EFGH',
      bulkPlaceholder: '每行一个 key',
      createBtn: '立即创建',
      cancel: '取消',
      delete: '删除',
      copied: '已复制！',
      copy: '复制',
      disable: '禁用',
      enable: '重新启用',
      noKeys: '暂无 key。',
      noWorkspaces: '暂无 workspace，请到 Workspaces 标签页创建',
      keyCol: 'CDK Key',
      wsCol: 'Workspace ID',
      statusCol: '状态',
      createdCol: '创建时间',
      emailCol: 'Email',
      actionsCol: '操作',
      notUsed: '—',
      bulkCheck: '批量检查',
      checkResult: '检查结果',
      bulkInput: '粘贴 key 列表（每行一个）',
      check: '检查',
      clearResults: '清空结果',
      notFound: '未找到',
      selectWs: '选择 Workspace',
      createdOk: '已创建',
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
                <div className="flex items-center gap-2">
                  {bulkResults.filter(r => r.found && r.status === 'live' && r.id).length > 0 && (
                    <button
                      onClick={handleBulkDisable}
                      disabled={bulkDisabling}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-all disabled:opacity-50"
                    >
                      {bulkDisabling ? <Loader2 size={12} className="animate-spin" /> : <ToggleRight size={12} strokeWidth={2} />}
                      {bulkDisabling && bulkDisableProgress.total > 0
                        ? (lang === 'zh' ? `正在禁用 ${bulkDisableProgress.current}/${bulkDisableProgress.total}…` : `Disabling ${bulkDisableProgress.current}/${bulkDisableProgress.total}…`)
                        : (lang === 'zh'
                            ? `禁用 ${bulkResults.filter(r => r.found && r.status === 'live' && r.id).length} 个未使用 key`
                            : `Disable ${bulkResults.filter(r => r.found && r.status === 'live' && r.id).length} live key(s)`)}
                    </button>
                  )}
                  <button onClick={() => setBulkResults([])} className="text-xs text-slate-500 hover:text-slate-300">
                    {t.clearResults}
                  </button>
                </div>
              </div>
              {bulkDisabling && bulkDisableProgress.total > 0 && (
                <div className="w-full bg-[#1a1d27] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-red-500 h-full transition-all duration-150"
                    style={{ width: `${(bulkDisableProgress.current / bulkDisableProgress.total) * 100}%` }}
                  />
                </div>
              )}
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
                      {r.status === 'not_found' ? t.notFound : STATUS_LABELS[r.status as keyof typeof STATUS_LABELS]?.[lang === 'zh' ? 'zh' : 'en']}
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

      {/* Selection action bar */}
      {!bulkMode && selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-indigo-200">
            <Check size={14} strokeWidth={2} />
            <span className="font-semibold">
              {lang === 'zh'
                ? `已选择 ${selectedIds.size} 个 key（${selectedLiveCount} 个未激活 key 可移动）`
                : `${selectedIds.size} key(s) selected (${selectedLiveCount} live movable)`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearSelection}
              disabled={moving || bulkDeleting}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#22253a] border border-[#2a2d3a] text-slate-300 hover:text-slate-100 transition-colors disabled:opacity-50"
            >
              {lang === 'zh' ? '取消选择' : 'Clear'}
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting || moving}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 font-semibold transition-colors disabled:opacity-50"
            >
              <span className="relative h-3 w-3 flex-shrink-0">
                <Loader2
                  size={12}
                  className={`absolute inset-0 transition-opacity ${bulkDeleting ? 'opacity-100 animate-spin' : 'opacity-0'}`}
                />
                <Trash2
                  size={12}
                  strokeWidth={2}
                  className={`absolute inset-0 transition-opacity ${bulkDeleting ? 'opacity-0' : 'opacity-100'}`}
                />
              </span>
              {bulkDeleting && bulkDeleteProgress.total > 0
                ? (lang === 'zh'
                    ? `正在删除 ${bulkDeleteProgress.current}/${bulkDeleteProgress.total}…`
                    : `Deleting ${bulkDeleteProgress.current}/${bulkDeleteProgress.total}…`)
                : (lang === 'zh' ? '删除已选' : 'Delete selected')}
            </button>
            <button
              onClick={openMoveModal}
              disabled={moving || bulkDeleting || selectedLiveCount === 0}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-semibold transition-colors disabled:opacity-50"
            >
              <ArrowRightLeft size={12} strokeWidth={2} />
              {lang === 'zh' ? `移动 live (${selectedLiveCount})` : `Move live (${selectedLiveCount})`}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {!bulkMode && (
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">{t.noKeys}</div>
          ) : (
            <div className="space-y-1">
              {/* Header */}
              <div
                className="grid gap-2 px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider items-center"
                style={{ gridTemplateColumns: '28px 1fr 1.4fr 1fr 1fr 1fr 80px' }}
              >
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={currentPageSelected}
                    onChange={e => e.target.checked ? selectCurrentPage() : clearCurrentPageSelection()}
                    className="accent-indigo-500 cursor-pointer"
                    title={lang === 'zh' ? '选择本页所有 key' : 'Select all keys on this page'}
                  />
                </div>
                <div>{t.keyCol}</div>
                <div>{t.wsCol}</div>
                <div>{t.statusCol}</div>
                <div>{t.createdCol}</div>
                <div>{t.emailCol}</div>
                <div />
              </div>

              {/* Rows */}
              {pagedKeys.map(key => (
                <div
                  key={key.id}
                  className="grid gap-2 items-center px-3 py-2.5 bg-[#1a1d27] rounded-lg hover:bg-[#22253a] transition-colors group"
                  style={{ gridTemplateColumns: '28px 1fr 1.4fr 1fr 1fr 1fr 80px' }}
                >
                  {/* Select */}
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(key.id)}
                      onChange={() => toggleSelect(key.id)}
                      className="accent-indigo-500 cursor-pointer"
                      title={lang === 'zh' ? '选择 key' : 'Select key'}
                    />
                  </div>

                  {/* Key */}
                  <div className="flex items-center gap-1.5">
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
                  <div>
                    <span className="text-[11px] font-mono text-slate-500 truncate block">{key.workspaceId}</span>
                  </div>

                  {/* Status */}
                  <div>
                    <span className={`text-xs font-semibold ${STATUS_LABELS[key.status].color}`}>
                      {STATUS_LABELS[key.status].zh}
                    </span>
                  </div>

                  {/* Created */}
                  <div>
                    <span className="text-[11px] text-slate-500">{formatDate(key.createdAt)}</span>
                  </div>

                  {/* Email */}
                  <div>
                    <span className="text-[11px] text-slate-400 truncate block">
                      {key.activatedEmail || t.notUsed}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
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

      {/* Pagination */}
      {!bulkMode && filtered.length > 0 && (
        <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
          <p className="text-[11px] text-slate-500">
            {lang === 'zh'
              ? `显示 ${pageRange.start}–${pageRange.end} / ${filtered.length}`
              : `Showing ${pageRange.start}–${pageRange.end} of ${filtered.length}`}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#22253a] border border-[#2a2d3a] rounded-lg p-1">
              <span className="text-[10px] text-slate-500 px-1">{lang === 'zh' ? '每页' : 'Per page'}</span>
              {PAGE_SIZE_OPTIONS.map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPageSize(size)}
                  className={`text-[11px] px-2 py-1 rounded-md font-semibold transition-colors ${
                    pageSize === size
                      ? 'bg-indigo-500 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#22253a] border border-[#2a2d3a] text-slate-300 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {lang === 'zh' ? '上一页' : 'Prev'}
              </button>
              <span className="text-[11px] text-slate-500 px-2">
                {currentPage} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                disabled={currentPage >= pageCount}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#22253a] border border-[#2a2d3a] text-slate-300 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {lang === 'zh' ? '下一页' : 'Next'}
              </button>
            </div>
          </div>
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
                  <WorkspaceSelect
                    value={newKeyWs}
                    onChange={setNewKeyWs}
                    workspaces={workspaces}
                    placeholder={t.selectWs}
                    emptyLabel={t.noWorkspaces}
                  />
                </div>
                <button
                  onClick={handleCreateSingle}
                  disabled={!newKeyKey.trim() || !newKeyWs.trim() || creating}
                  className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <span className="relative h-3.5 w-3.5 flex-shrink-0">
                    <Loader2
                      size={14}
                      className={`absolute inset-0 transition-opacity ${creating ? 'opacity-100 animate-spin' : 'opacity-0'}`}
                    />
                    <Plus
                      size={14}
                      className={`absolute inset-0 transition-opacity ${creating ? 'opacity-0' : 'opacity-100'}`}
                    />
                  </span>
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
                  <WorkspaceSelect
                    value={bulkWsId}
                    onChange={setBulkWsId}
                    workspaces={workspaces}
                    placeholder={t.selectWs}
                    emptyLabel={t.noWorkspaces}
                    className="mb-3"
                  />
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
                  <span className="relative h-3.5 w-3.5 flex-shrink-0">
                    <Loader2
                      size={14}
                      className={`absolute inset-0 transition-opacity ${creating ? 'opacity-100 animate-spin' : 'opacity-0'}`}
                    />
                    <Plus
                      size={14}
                      className={`absolute inset-0 transition-opacity ${creating ? 'opacity-0' : 'opacity-100'}`}
                    />
                  </span>
                  {creating && bulkProgress.total > 0
                    ? (lang === 'zh'
                        ? `正在创建 ${bulkProgress.current}/${bulkProgress.total}…`
                        : `Creating ${bulkProgress.current}/${bulkProgress.total}…`)
                    : `${t.createBtn} (${bulkInput.split('\n').filter(Boolean).length})`}
                </button>
                {creating && bulkProgress.total > 0 && (
                  <div className="w-full bg-[#22253a] rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full transition-all duration-150"
                      style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                    />
                  </div>
                )}
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

      {/* Move to Workspace Modal */}
      {showMove && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={16} strokeWidth={2} className="text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  {lang === 'zh' ? '移动 key 到其他 workspace' : 'Move keys to another workspace'}
                </h3>
              </div>
              <button
                onClick={() => { if (!moving) { setShowMove(false); setMoveError('') } }}
                disabled={moving}
                className="text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              {lang === 'zh'
                ? `旧 workspace 可能已失效。选择新的 workspace 来移动 ${keys.filter(k => selectedIds.has(k.id) && k.status === 'live').length} 个未激活 key。`
                : `The old workspace may have died. Pick a new workspace for the ${keys.filter(k => selectedIds.has(k.id) && k.status === 'live').length} unactivated key(s).`}
            </p>

            <label className="block text-xs text-slate-500 mb-1.5">{t.selectWs}</label>
            <WorkspaceSelect
              value={moveTargetWs}
              onChange={setMoveTargetWs}
              workspaces={workspaces}
              placeholder={t.selectWs}
              emptyLabel={t.noWorkspaces}
              disabled={moving}
              className="mb-3"
            />

            <button
              onClick={handleMove}
              disabled={moving || !moveTargetWs.trim()}
              className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {moving ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
              {moving && moveProgress.total > 0
                ? (lang === 'zh'
                    ? `正在移动 ${moveProgress.current}/${moveProgress.total}…`
                    : `Moving ${moveProgress.current}/${moveProgress.total}…`)
                : (lang === 'zh' ? '移动 workspace' : 'Move workspace')}
            </button>
            {moving && moveProgress.total > 0 && (
              <div className="w-full bg-[#22253a] rounded-full h-2 overflow-hidden mt-3">
                <div
                  className="bg-indigo-500 h-full transition-all duration-150"
                  style={{ width: `${(moveProgress.current / moveProgress.total) * 100}%` }}
                />
              </div>
            )}
            {moveError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-300 mt-3">
                <X size={14} className="flex-shrink-0 mt-0.5" strokeWidth={2} />
                <span>{moveError}</span>
              </div>
            )}
            {moveSuccess && !moveError && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-emerald-300 mt-3">
                <Check size={14} strokeWidth={2} />
                <span>{moveSuccess}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
