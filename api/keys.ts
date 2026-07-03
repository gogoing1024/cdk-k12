import type { VercelRequest, VercelResponse } from '@vercel/node'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
}

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'tandu05-secure-2026'

const KEY_PREFIX = 'cdk:key:'
const KEY_INDEX = 'cdk:keys:index'
const KEYS_ALL = 'cdk:keys:all'
const WS_PREFIX = 'cdk:ws:'
const WS_INDEX = 'cdk:ws:index'
const WS_ALL = 'cdk:ws:all'
const DEFAULT_WS = {
  id: 'default',
  name: 'Default Workspace',
  workspaceId: '5e4c9b31-1b4e-4887-839b-607597928d7c',
  isDefault: true,
  createdAt: 1700000000000,
}

function isAdmin(req: VercelRequest): boolean {
  const token = req.headers['x-admin-token']
  return token === ADMIN_TOKEN
}

async function redis(cmd: string[]): Promise<any> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    throw new Error(
      `Missing Redis env vars. KV_REST_API_URL=${url ? 'set' : 'MISSING'}, KV_REST_API_TOKEN=${token ? 'set' : 'MISSING'}`
    )
  }

  const fullUrl = `${url.replace(/\/$/, '')}/${cmd.map(encodeURIComponent).join('/')}`
  const res = await fetch(fullUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Redis HTTP ${res.status}: ${body}`)
  }
  const json = (await res.json()) as { result: any }
  const result = json.result

  if (cmd[0] === 'GET' && typeof result === 'string') {
    try {
      return JSON.parse(result)
    } catch {
      return result
    }
  }
  return result
}

function getAction(req: VercelRequest): string {
  return String(
    (req.query.action as string) ||
    (req.body && req.body.action) ||
    ''
  )
}

// Read all keys from Redis. Uses cached snapshot (KEYS_ALL) when available;
// falls back to scanning individual records and rebuilds the cache.
async function readAllKeys(): Promise<any[]> {
  const cached = await redis(['GET', KEYS_ALL])
  if (Array.isArray(cached)) return cached

  const ids = (await redis(['SMEMBERS', KEY_INDEX])) as string[]
  if (ids.length === 0) {
    await redis(['SET', KEYS_ALL, JSON.stringify([])])
    return []
  }

  const recs = await Promise.all(
    ids.map(id => redis(['GET', KEY_PREFIX + id]))
  )
  const items = recs.filter(Boolean)
  await redis(['SET', KEYS_ALL, JSON.stringify(items)])
  return items
}

// Write all keys to Redis + persist the snapshot for fast subsequent reads
async function writeAllKeys(keys: any[]): Promise<void> {
  await redis(['SET', KEYS_ALL, JSON.stringify(keys)])
  await redis(['DEL', KEY_INDEX])
  if (keys.length > 0) {
    await redis(['SADD', KEY_INDEX, ...keys.map(k => k.id)])
  }
}

async function readAllWorkspaces(): Promise<any[]> {
  const cached = await redis(['GET', WS_ALL])
  if (Array.isArray(cached)) return cached

  const ids = (await redis(['SMEMBERS', WS_INDEX])) as string[]
  if (ids.length === 0) {
    const seed = [DEFAULT_WS]
    await redis(['SET', WS_ALL, JSON.stringify(seed)])
    return seed
  }

  const recs = await Promise.all(ids.map(id => redis(['GET', WS_PREFIX + id])))
  const items = recs.filter(Boolean)
  if (items.length === 0) {
    const seed = [DEFAULT_WS]
    await redis(['SET', WS_ALL, JSON.stringify(seed)])
    return seed
  }
  await redis(['SET', WS_ALL, JSON.stringify(items)])
  return items
}

async function writeAllWorkspaces(list: any[]): Promise<void> {
  if (list.length === 0) list.push(DEFAULT_WS)
  await redis(['SET', WS_ALL, JSON.stringify(list)])
  await redis(['DEL', WS_INDEX])
  await redis(['SADD', WS_INDEX, ...list.map(w => w.id)])
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))
    return res.status(204).end()
  }

  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))

  try {
    const action = getAction(req)

    // Public: lookup key by key string - direct individual lookup is fine
    if (action === 'lookup') {
      const key = String(req.query.key || req.body?.key || '').trim().toLowerCase()
      if (!key) return res.status(400).json({ error: { message: 'Missing key' } })

      const items = await readAllKeys()
      const found = items.find((r: any) => String(r.key).toLowerCase() === key)
      if (!found) return res.status(404).json({ error: { message: 'Key not found' } })
      return res.status(200).json({ key: found })
    }

    // Public: mark key as used
    if (action === 'use') {
      const { key, email } = req.body || {}
      if (!key) return res.status(400).json({ error: { message: 'Missing key' } })

      const items = await readAllKeys()
      const idx = items.findIndex((r: any) => String(r.key).toLowerCase() === String(key).toLowerCase())
      if (idx === -1) return res.status(404).json({ error: { message: 'Key not found' } })
      if (items[idx].status !== 'live') {
        return res.status(409).json({ error: { message: 'Key is not live' } })
      }
      items[idx] = {
        ...items[idx],
        status: 'used',
        activatedAt: Date.now(),
        activatedEmail: email || '',
      }
      await writeAllKeys(items)
      return res.status(200).json({ key: items[idx] })
    }

    if (!isAdmin(req)) {
      return res.status(401).json({ error: { message: 'Unauthorized' } })
    }

    if (action === 'list') {
      const items = await readAllKeys()
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      return res.status(200).json({ keys: items })
    }

    if (action === 'stats') {
      const items = await readAllKeys()
      let live = 0
      let used = 0
      let disabled = 0
      for (const rec of items) {
        if (rec.status === 'live') live++
        else if (rec.status === 'used') used++
        else if (rec.status === 'disabled') disabled++
      }
      return res.status(200).json({ total: items.length, live, used, disabled })
    }

    if (action === 'add') {
      const rec = req.body?.key
      if (!rec || !rec.id || !rec.key) {
        return res.status(400).json({ error: { message: 'Invalid key record' } })
      }
      const items = await readAllKeys()
      if (items.some((r: any) => r.id === rec.id)) {
        return res.status(409).json({ error: { message: 'Key id already exists' } })
      }
      items.push(rec)
      await writeAllKeys(items)
      return res.status(200).json({ key: rec })
    }

    if (action === 'update') {
      const rec = req.body?.key
      if (!rec || !rec.id) {
        return res.status(400).json({ error: { message: 'Invalid key record' } })
      }
      const items = await readAllKeys()
      const idx = items.findIndex((r: any) => r.id === rec.id)
      if (idx === -1) return res.status(404).json({ error: { message: 'Key not found' } })
      items[idx] = rec
      await writeAllKeys(items)
      return res.status(200).json({ key: rec })
    }

    if (action === 'delete') {
      const id = String(req.query.id || req.body?.id || '')
      if (!id) return res.status(400).json({ error: { message: 'Missing id' } })
      const items = await readAllKeys()
      const next = items.filter((r: any) => r.id !== id)
      await writeAllKeys(next)
      return res.status(200).json({ ok: true })
    }

    if (action === 'replace-all') {
      const keys = (req.body?.keys || []) as any[]
      await writeAllKeys(keys)
      return res.status(200).json({ ok: true, count: keys.length })
    }

    if (action === 'ws:list') {
      const items = await readAllWorkspaces()
      return res.status(200).json({ workspaces: items })
    }

    if (action === 'ws:replace-all') {
      const list = (req.body?.workspaces || []) as any[]
      await writeAllWorkspaces(list)
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: { message: 'Unknown action' } })
  } catch (err: any) {
    return res.status(500).json({ error: { message: 'Server error', detail: String(err?.message || err) } })
  }
}