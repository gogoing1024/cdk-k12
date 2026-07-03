import type { CDKKey, Workspace, AdminSession } from './types'

const ADMIN_TOKEN_KEY = 'cdk_admin_token_v1'
const KEYS_CACHE_KEY = 'cdk_keys_cache_v3'
const WS_CACHE_KEY = 'cdk_ws_cache_v3'
const KEYS_TTL_MS = 5 * 60 * 1000
const WS_TTL_MS = 10 * 60 * 1000

function getAdminToken(): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(ADMIN_TOKEN_KEY) || ''
}

function adminHeaders(): Record<string, string> {
  const token = getAdminToken()
  return token ? { 'x-admin-token': token } : {}
}

function readCache<T>(key: string, ttl: number): T | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { ts: number; data: T }
    if (!parsed?.ts || Date.now() - parsed.ts > ttl) return null
    return parsed.data
  } catch {
    return null
  }
}

function writeCache(key: string, data: unknown): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }))
  } catch {}
}

function invalidateKeys() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(KEYS_CACHE_KEY)
}
function invalidateWs() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(WS_CACHE_KEY)
}

// In-memory layer (faster than localStorage on subsequent calls in same page lifetime)
const memCache = {
  keys: { ts: 0, data: null as CDKKey[] | null },
  ws: { ts: 0, data: null as Workspace[] | null },
}

// In-flight dedup so concurrent callers share one HTTP request
const inflight = {
  keys: null as Promise<CDKKey[]> | null,
  ws: null as Promise<Workspace[]> | null,
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

/**
 * Returns cached list if fresh. Otherwise fetches from API and warms both
 * memory + localStorage. Subsequent reads within KEYS_TTL_MS are instant.
 * Concurrent callers share a single in-flight request.
 */
export async function getCDKKeys(forceRefresh = false): Promise<CDKKey[]> {
  const now = Date.now()

  if (!forceRefresh) {
    if (memCache.keys.data && now - memCache.keys.ts < KEYS_TTL_MS) {
      return memCache.keys.data
    }
    const cached = readCache<CDKKey[]>(KEYS_CACHE_KEY, KEYS_TTL_MS)
    if (cached) {
      memCache.keys = { ts: now, data: cached }
      return cached
    }
  }

  if (inflight.keys) return inflight.keys

  inflight.keys = (async () => {
    try {
      const j = await apiGet('list')
      const keys: CDKKey[] = j.keys || []
      memCache.keys = { ts: Date.now(), data: keys }
      writeCache(KEYS_CACHE_KEY, keys)
      return keys
    } finally {
      inflight.keys = null
    }
  })()
  return inflight.keys
}

export async function setCDKKeys(keys: CDKKey[]): Promise<void> {
  await apiSend('POST', 'replace-all', { keys })
  invalidateKeys()
  memCache.keys = { ts: Date.now(), data: keys }
  writeCache(KEYS_CACHE_KEY, keys)
}

export async function addCDKKey(key: CDKKey): Promise<void> {
  await apiSend('POST', 'add', { key })
  // Append to in-memory cache so callers don't need to refetch the full list
  if (memCache.keys.data) {
    memCache.keys = { ts: Date.now(), data: [...memCache.keys.data, key] }
    writeCache(KEYS_CACHE_KEY, memCache.keys.data)
  }
}

export async function updateCDKKey(id: string, updates: Partial<CDKKey>): Promise<CDKKey> {
  const all = await getCDKKeys()
  const existing = all.find(k => k.id === id)
  if (!existing) throw new Error('Key not found')
  const merged = { ...existing, ...updates }
  const j = await apiSend('PUT', 'update', { key: merged })
  // Update cache in place to avoid full reload
  if (memCache.keys.data) {
    memCache.keys = {
      ts: Date.now(),
      data: memCache.keys.data.map(k => k.id === id ? j.key : k),
    }
    writeCache(KEYS_CACHE_KEY, memCache.keys.data)
  }
  return j.key
}

export async function deleteCDKKey(id: string): Promise<void> {
  await apiSend('DELETE', 'delete', { id })
  // Remove from cache so callers don't need to refetch
  if (memCache.keys.data) {
    memCache.keys = {
      ts: Date.now(),
      data: memCache.keys.data.filter(k => k.id !== id),
    }
    writeCache(KEYS_CACHE_KEY, memCache.keys.data)
  }
}

export async function getCDKKeyByKey(key: string): Promise<CDKKey | undefined> {
  // Lookup always hits API - freshness is critical, no caching
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
  invalidateKeys()
  memCache.keys = { ts: 0, data: null }
}

// ==================== Workspaces ====================

export async function getWorkspaces(forceRefresh = false): Promise<Workspace[]> {
  const now = Date.now()

  if (!forceRefresh) {
    if (memCache.ws.data && now - memCache.ws.ts < WS_TTL_MS) {
      return memCache.ws.data
    }
    const cached = readCache<Workspace[]>(WS_CACHE_KEY, WS_TTL_MS)
    if (cached) {
      memCache.ws = { ts: now, data: cached }
      return cached
    }
  }

  if (inflight.ws) return inflight.ws

  inflight.ws = (async () => {
    try {
      const j = await apiGet('ws:list')
      const list: Workspace[] = j.workspaces || []
      memCache.ws = { ts: Date.now(), data: list }
      writeCache(WS_CACHE_KEY, list)
      return list
    } finally {
      inflight.ws = null
    }
  })()
  return inflight.ws
}

export async function setWorkspaces(workspaces: Workspace[]): Promise<void> {
  await apiSend('POST', 'ws:replace-all', { workspaces })
  invalidateWs()
  memCache.ws = { ts: Date.now(), data: workspaces }
  writeCache(WS_CACHE_KEY, workspaces)
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
  invalidateKeys()
  invalidateWs()
  memCache.keys = { ts: 0, data: null }
  memCache.ws = { ts: 0, data: null }
}