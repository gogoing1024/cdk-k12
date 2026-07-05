import { useState, useEffect, useCallback } from 'react'
import {
  Server, Plus, Edit3, X, Check, Trash2, Star, Copy, CheckCircle,
} from 'lucide-react'
import { Workspace, formatDate } from './types'
import {
  getWorkspaces, addWorkspace, updateWorkspace, deleteWorkspace,
} from './db'

interface WorkspaceManagerProps {
  lang: 'zh' | 'en'
  onWorkspacesChanged?: () => void
}

export default function WorkspaceManager({ lang, onWorkspacesChanged }: WorkspaceManagerProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newWsId, setNewWsId] = useState('')
  const [editName, setEditName] = useState('')
  const [editWsId, setEditWsId] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const loadData = useCallback(async (force = false) => {
    setWorkspaces(await getWorkspaces(force))
  }, [])

  useEffect(() => {
    loadData(true)
  }, [loadData])

  async function handleCreate() {
    if (!newName.trim() || !newWsId.trim()) return
    const ws: Workspace = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      workspaceId: newWsId.trim(),
      isDefault: false,
      createdAt: Date.now(),
    }
    await addWorkspace(ws)
    await loadData()
    setNewName('')
    setNewWsId('')
    setShowCreate(false)
    onWorkspacesChanged?.()
  }

  async function handleEdit(id: string) {
    if (!editName.trim() || !editWsId.trim()) return
    await updateWorkspace(id, { name: editName.trim(), workspaceId: editWsId.trim() })
    await loadData()
    setShowEdit(null)
    onWorkspacesChanged?.()
  }

  async function handleDelete(id: string) {
    await deleteWorkspace(id)
    await loadData()
    setDeleteConfirm(null)
    onWorkspacesChanged?.()
  }

  async function handleSetDefault(id: string) {
    const next = workspaces.map(w => ({ ...w, isDefault: w.id === id }))
    await setWorkspaces(next)
    setWorkspaces(next)
    onWorkspacesChanged?.()
  }

  function copyWsId(id: string) {
    const ws = workspaces.find(w => w.id === id)
    if (!ws) return
    navigator.clipboard.writeText(ws.workspaceId).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  function startEdit(ws: Workspace) {
    setEditName(ws.name)
    setEditWsId(ws.workspaceId)
    setShowEdit(ws.id)
  }

  const labels = {
    zh: {
      title: 'Workspace 管理',
      add: '添加 Workspace',
      nameLabel: 'Workspace 名称',
      wsIdLabel: 'Workspace ID',
      namePlaceholder: '例如：主 Workspace',
      wsIdPlaceholder: '例如：5e4c9b31-1b4e-4887-839b-607597928d7c',
      create: '新建',
      save: '保存',
      cancel: '取消',
      delete: '删除',
      default: '默认',
      setDefault: '设为默认',
      noWorkspaces: '暂无 workspace。',
      colName: '名称',
      colWsId: 'Workspace ID',
      colCreated: '创建时间',
      colActions: '操作',
    },
    en: {
      title: 'Workspace Management',
      add: 'Add Workspace',
      nameLabel: 'Workspace Name',
      wsIdLabel: 'Workspace ID',
      namePlaceholder: 'e.g. Main Workspace',
      wsIdPlaceholder: 'e.g. 5e4c9b31-1b4e-4887-839b-607597928d7c',
      create: 'Create',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      default: 'Default',
      setDefault: 'Set as Default',
      noWorkspaces: 'No workspaces yet.',
      colName: 'Name',
      colWsId: 'Workspace ID',
      colCreated: 'Created',
      colActions: 'Actions',
    },
  }
  const t = labels[lang]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server size={18} className="text-indigo-400" strokeWidth={1.5} />
          <h2 className="text-sm font-bold text-slate-100">{t.title}</h2>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white transition-all"
        >
          <Plus size={14} strokeWidth={2} />
          {t.add}
        </button>
      </div>

      {/* List */}
      {workspaces.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-xs">{t.noWorkspaces}</div>
      ) : (
        <div className="space-y-2">
          {workspaces.map(ws => (
            <div
              key={ws.id}
              className={`bg-[#1a1d27] rounded-xl p-4 border transition-all ${
                ws.isDefault ? 'border-indigo-500/40' : 'border-[#2a2d3a]'
              }`}
            >
              {showEdit === ws.id ? (
                <div className="space-y-3">
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder={t.namePlaceholder}
                    className="w-full bg-[#22253a] border border-[#2a2d3a] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50"
                  />
                  <input
                    value={editWsId}
                    onChange={e => setEditWsId(e.target.value)}
                    placeholder={t.wsIdPlaceholder}
                    className="w-full bg-[#22253a] border border-[#2a2d3a] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500/50"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(ws.id)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white transition-all"
                    >
                      <Check size={12} strokeWidth={2} />
                      {t.save}
                    </button>
                    <button
                      onClick={() => setShowEdit(null)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#22253a] border border-[#2a2d3a] text-slate-400 hover:text-slate-200 transition-all"
                    >
                      <X size={12} strokeWidth={2} />
                      {t.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-100 truncate">{ws.name}</span>
                      {ws.isDefault && (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold">
                          <Star size={8} strokeWidth={2} />
                          {t.default}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-500 truncate">{ws.workspaceId}</span>
                      <button
                        onClick={() => copyWsId(ws.id)}
                        className="text-slate-600 hover:text-indigo-400 transition-colors flex-shrink-0"
                      >
                        {copied === ws.id ? (
                          <CheckCircle size={12} className="text-emerald-400" strokeWidth={2} />
                        ) : (
                          <Copy size={12} strokeWidth={1.5} />
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1">{formatDate(ws.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    {!ws.isDefault && (
                      <button
                        onClick={() => handleSetDefault(ws.id)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                        title={t.setDefault}
                      >
                        <Star size={14} strokeWidth={1.5} />
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(ws)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                    >
                      <Edit3 size={14} strokeWidth={1.5} />
                    </button>
                    {!ws.isDefault && (
                      deleteConfirm === ws.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(ws.id)} className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-all">
                            <Check size={14} strokeWidth={2} />
                          </button>
                          <button onClick={() => setDeleteConfirm(null)} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300">
                            <X size={14} strokeWidth={2} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(ws.id)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 size={14} strokeWidth={1.5} />
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-slate-100">{t.add}</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-slate-300">
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">{t.nameLabel}</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  className="w-full bg-[#22253a] border border-[#2a2d3a] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">{t.wsIdLabel}</label>
                <input
                  type="text"
                  value={newWsId}
                  onChange={e => setNewWsId(e.target.value)}
                  placeholder={t.wsIdPlaceholder}
                  className="w-full bg-[#22253a] border border-[#2a2d3a] rounded-xl px-4 py-3 text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || !newWsId.trim()}
                className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Plus size={14} />
                {t.create}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
