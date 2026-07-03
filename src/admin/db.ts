import type { CDKKey, Workspace, AdminSession } from './types'

const ADMIN_TOKEN_KEY = 'cdk_admin_token_v1'

function getAdminToken(): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(ADMIN_TOKEN_KEY) || ''
}

function adminHeaders(): Record<string, string> {
  const token = getAdminToken()
  return token ? { 'x-admin-token': token } : {}
}

async function apiGet(action: string, params: Record<string, string> = {}): Promise<any> {
  const qs = new URLSearchParams({ action, ...params }).toString()
  const res = await fetch(`/api/keys?${qs}`, { headers: adminHeaders() })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const j = await res.json()
      msg = j?.error?.message || msg
    } catch {}
    throw new Error(msg)
  }
  return res.json()
}

async function apiSend(method: string, action: string, body: any): Promise<any> {
  const res = await fetch(`/api/keys?action=${action}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const j = await res.json()
      msg = j?.error?.message || msg
    } catch {}
    throw new Error(msg)
  }
  return res.json()
}

// ==================== CDK Keys ====================

export async function getCDKKeys(): Promise<CDKKey[]> {
  const j = await apiGet('list')
  return j.keys || []
}

export async function setCDKKeys(keys: CDKKey[]): Promise<void> {
  await apiSend('POST', 'replace-all', { keys })
}

export async function addCDKKey(key: CDKKey): Promise<void> {
  await apiSend('POST', 'add', { key })
}

export async function updateCDKKey(id: string, updates: Partial<CDKKey>): Promise<CDKKey> {
  const all = await getCDKKeys()
  const existing = all.find(k => k.id === id)
  if (!existing) throw new Error('Key not found')
  const merged = { ...existing, ...updates }
  const j = await apiSend('PUT', 'update', { key: merged })
  return j.key
}

export async function deleteCDKKey(id: string): Promise<void> {
  await apiSend('DELETE', 'delete', { id })
}

export async function getCDKKeyByKey(key: string): Promise<CDKKey | undefined> {
  try {
    const j = await apiGet('lookup', { key })
    return j.key
  } catch (err: any) {
    if (String(err?.message || '').toLowerCase().includes('not found')) return undefined
    throw err
  }
}

export async function checkCDKKeyStatus(key: string): Promise<CDKKey | undefined> {
  return getCDKKeyByKey(key)
}

export async function markCDKKeyUsed(key: string, email: string): Promise<void> {
  await apiSend('POST', 'use', { key, email })
}

// ==================== Workspaces ====================

export async function getWorkspaces(): Promise<Workspace[]> {
  const j = await apiGet('ws:list')
  return j.workspaces || []
}

export async function setWorkspaces(workspaces: Workspace[]): Promise<void> {
  await apiSend('POST', 'ws:replace-all', { workspaces })
}

export async function addWorkspace(ws: Workspace): Promise<void> {
  const list = await getWorkspaces()
  await setWorkspaces([...list, ws])
}

export async function updateWorkspace(id: string, updates: Partial<Workspace>): Promise<Workspace | null> {
  const list = await getWorkspaces()
  const next = list.map(w => (w.id === id ? { ...w, ...updates } : w))
  await setWorkspaces(next)
  return next.find(w => w.id === id) || null
}

export async function deleteWorkspace(id: string): Promise<void> {
  const list = await getWorkspaces()
  const next = list.filter(w => w.id !== id)
  await setWorkspaces(next)
}

// ==================== Admin Session ====================

const SESSION_KEY = 'cdk_admin_session_v1'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function getAdminSession(): Promise<AdminSession> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null
    const session = raw ? (JSON.parse(raw) as AdminSession) : null
    if (!session || !session.isLoggedIn || !session.loginAt) {
      return { isLoggedIn: false, username: '', loginAt: 0 }
    }
    if (Date.now() - session.loginAt > SESSION_TTL_MS) {
      await clearAdminSession()
      return { isLoggedIn: false, username: '', loginAt: 0 }
    }
    return session
  } catch {
    return { isLoggedIn: false, username: '', loginAt: 0 }
  }
}

export async function setAdminSession(session: AdminSession): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  }
}

export async function clearAdminSession(): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(SESSION_KEY)
  }
}

// ==================== Admin Login ====================

const ADMIN_USERNAME = 'tandu05'
const ADMIN_PASSWORD = 'Tandu1710@'
const BACKEND_ADMIN_TOKEN = 'tandu05-secure-2026'

export async function loginAdmin(username: string, password: string): Promise<boolean> {
  if (username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ADMIN_TOKEN_KEY, BACKEND_ADMIN_TOKEN)
    }
    return true
  }
  return false
}

export async function logoutAdmin(): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
  }
  await clearAdminSession()
}