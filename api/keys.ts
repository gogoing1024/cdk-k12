import type { VercelRequest, VercelResponse } from '@vercel/node'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
}

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'tandu05-secure-2026'

const KEY_PREFIX = 'cdk:key:'
const KEY_INDEX = 'cdk:keys:index'
const WS_PREFIX = 'cdk:ws:'
const WS_INDEX = 'cdk:ws:index'
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

// Minimal Upstash Redis REST client - bypasses @vercel/kv env detection issues
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
  return json.result
}

function getAction(req: VercelRequest): string {
  return String(
    (req.query.action as string) ||
    (req.body && req.body.action) ||
    ''
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))
    return res.status(204).end()
  }

  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))

  try {
    const action = getAction(req)

    // Public: lookup key by key string
    if (action === 'lookup') {
      const key = String(req.query.key || req.body?.key || '').trim().toLowerCase()
      if (!key) return res.status(400).json({ error: { message: 'Missing key' } })

      const ids = (await redis(['SMEMBERS', KEY_INDEX])) as string[]
      for (const id of ids) {
        const rec = (await redis(['GET', KEY_PREFIX + id])) as any
        if (rec && String(rec.key).toLowerCase() === key) {
          return res.status(200).json({ key: rec })
        }
      }
      return res.status(404).json({ error: { message: 'Key not found' } })
    }

    // Public: mark key as used
    if (action === 'use') {
      const { key, email } = req.body || {}
      if (!key) return res.status(400).json({ error: { message: 'Missing key' } })

      const ids = (await redis(['SMEMBERS', KEY_INDEX])) as string[]
      for (const id of ids) {
        const rec = (await redis(['GET', KEY_PREFIX + id])) as any
        if (rec && String(rec.key).toLowerCase() === String(key).toLowerCase()) {
          if (rec.status !== 'live') {
            return res.status(409).json({ error: { message: 'Key is not live' } })
          }
          const updated = {
            ...rec,
            status: 'used',
            activatedAt: Date.now(),
            activatedEmail: email || '',
          }
          await redis(['SET', KEY_PREFIX + id, JSON.stringify(updated)])
          return res.status(200).json({ key: updated })
        }
      }
      return res.status(404).json({ error: { message: 'Key not found' } })
    }

    // Admin-only from here
    if (!isAdmin(req)) {
      return res.status(401).json({ error: { message: 'Unauthorized' } })
    }

    if (action === 'list') {
      const ids = (await redis(['SMEMBERS', KEY_INDEX])) as string[]
      const items: any[] = []
      for (const id of ids) {
        const rec = await redis(['GET', KEY_PREFIX + id])
        if (rec) items.push(rec)
      }
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      return res.status(200).json({ keys: items })
    }

    if (action === 'add') {
      const rec = req.body?.key
      if (!rec || !rec.id || !rec.key) {
        return res.status(400).json({ error: { message: 'Invalid key record' } })
      }
      await redis(['SET', KEY_PREFIX + rec.id, JSON.stringify(rec)])
      await redis(['SADD', KEY_INDEX, rec.id])
      return res.status(200).json({ key: rec })
    }

    if (action === 'update') {
      const rec = req.body?.key
      if (!rec || !rec.id) {
        return res.status(400).json({ error: { message: 'Invalid key record' } })
      }
      await redis(['SET', KEY_PREFIX + rec.id, JSON.stringify(rec)])
      return res.status(200).json({ key: rec })
    }

    if (action === 'delete') {
      const id = String(req.query.id || req.body?.id || '')
      if (!id) return res.status(400).json({ error: { message: 'Missing id' } })
      await redis(['DEL', KEY_PREFIX + id])
      await redis(['SREM', KEY_INDEX, id])
      return res.status(200).json({ ok: true })
    }

    if (action === 'replace-all') {
      const keys = (req.body?.keys || []) as any[]
      const oldIds = (await redis(['SMEMBERS', KEY_INDEX])) as string[]
      for (const id of oldIds) {
        await redis(['DEL', KEY_PREFIX + id])
      }
      await redis(['DEL', KEY_INDEX])
      for (const rec of keys) {
        await redis(['SET', KEY_PREFIX + rec.id, JSON.stringify(rec)])
        await redis(['SADD', KEY_INDEX, rec.id])
      }
      return res.status(200).json({ ok: true, count: keys.length })
    }

    // Workspaces
    if (action === 'ws:list') {
      const ids = (await redis(['SMEMBERS', WS_INDEX])) as string[]
      if (ids.length === 0) {
        await redis(['SET', WS_PREFIX + DEFAULT_WS.id, JSON.stringify(DEFAULT_WS)])
        await redis(['SADD', WS_INDEX, DEFAULT_WS.id])
        return res.status(200).json({ workspaces: [DEFAULT_WS] })
      }
      const items: any[] = []
      for (const id of ids) {
        const rec = await redis(['GET', WS_PREFIX + id])
        if (rec) items.push(rec)
      }
      return res.status(200).json({ workspaces: items })
    }

    if (action === 'ws:replace-all') {
      const list = (req.body?.workspaces || []) as any[]
      if (list.length === 0) list.push(DEFAULT_WS)
      const oldIds = (await redis(['SMEMBERS', WS_INDEX])) as string[]
      for (const id of oldIds) {
        await redis(['DEL', WS_PREFIX + id])
      }
      await redis(['DEL', WS_INDEX])
      for (const rec of list) {
        await redis(['SET', WS_PREFIX + rec.id, JSON.stringify(rec)])
        await redis(['SADD', WS_INDEX, rec.id])
      }
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: { message: 'Unknown action' } })
  } catch (err: any) {
    return res.status(500).json({ error: { message: 'Server error', detail: String(err?.message || err) } })
  }
}