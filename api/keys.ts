import { kv } from '@vercel/kv'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
}

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'tandu05-secure-2026'

const KEY_PREFIX = 'cdk:key:'
const KEY_INDEX = 'cdk:keys:index' // set of all key ids
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))
    return res.status(204).end()
  }

  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))

  try {
    const action = String((req.query.action as string) || (req.body && req.body.action) || '')

    // Public: lookup key by key string (used during activation)
    if (req.method === 'GET' && action === 'lookup') {
      const key = String(req.query.key || '').trim().toLowerCase()
      if (!key) return res.status(400).json({ error: { message: 'Missing key' } })

      const ids = (await kv.smembers(KEY_INDEX)) as string[]
      for (const id of ids) {
        const rec = (await kv.get(KEY_PREFIX + id)) as any
        if (rec && String(rec.key).toLowerCase() === key) {
          return res.status(200).json({ key: rec })
        }
      }
      return res.status(404).json({ error: { message: 'Key not found' } })
    }

    // Public: mark key as used (called by activation flow)
    if (req.method === 'POST' && action === 'use') {
      const { key, email } = req.body || {}
      if (!key) return res.status(400).json({ error: { message: 'Missing key' } })

      const ids = (await kv.smembers(KEY_INDEX)) as string[]
      for (const id of ids) {
        const rec = (await kv.get(KEY_PREFIX + id)) as any
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
          await kv.set(KEY_PREFIX + id, updated)
          return res.status(200).json({ key: updated })
        }
      }
      return res.status(404).json({ error: { message: 'Key not found' } })
    }

    // Admin-only from here
    if (!isAdmin(req)) {
      return res.status(401).json({ error: { message: 'Unauthorized' } })
    }

    // List all keys
    if (req.method === 'GET' && action === 'list') {
      const ids = (await kv.smembers(KEY_INDEX)) as string[]
      const items: any[] = []
      for (const id of ids) {
        const rec = (await kv.get(KEY_PREFIX + id)) as any
        if (rec) items.push(rec)
      }
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      return res.status(200).json({ keys: items })
    }

    // Add a new key
    if (req.method === 'POST' && action === 'add') {
      const rec = req.body?.key
      if (!rec || !rec.id || !rec.key) {
        return res.status(400).json({ error: { message: 'Invalid key record' } })
      }
      await kv.set(KEY_PREFIX + rec.id, rec)
      await kv.sadd(KEY_INDEX, rec.id)
      return res.status(200).json({ key: rec })
    }

    // Update a key
    if (req.method === 'PUT' && action === 'update') {
      const rec = req.body?.key
      if (!rec || !rec.id) {
        return res.status(400).json({ error: { message: 'Invalid key record' } })
      }
      await kv.set(KEY_PREFIX + rec.id, rec)
      return res.status(200).json({ key: rec })
    }

    // Delete a key
    if (req.method === 'DELETE' && action === 'delete') {
      const id = String(req.query.id || req.body?.id || '')
      if (!id) return res.status(400).json({ error: { message: 'Missing id' } })
      await kv.del(KEY_PREFIX + id)
      await kv.srem(KEY_INDEX, id)
      return res.status(200).json({ ok: true })
    }

    // Replace all keys (bulk save)
    if (req.method === 'POST' && action === 'replace-all') {
      const keys = (req.body?.keys || []) as any[]
      const oldIds = (await kv.smembers(KEY_INDEX)) as string[]
      for (const id of oldIds) {
        await kv.del(KEY_PREFIX + id)
      }
      await kv.del(KEY_INDEX)
      for (const rec of keys) {
        await kv.set(KEY_PREFIX + rec.id, rec)
        await kv.sadd(KEY_INDEX, rec.id)
      }
      return res.status(200).json({ ok: true, count: keys.length })
    }

    // Workspaces
    if (req.method === 'GET' && action === 'ws:list') {
      const ids = (await kv.smembers(WS_INDEX)) as string[]
      if (ids.length === 0) {
        await kv.set(WS_PREFIX + DEFAULT_WS.id, DEFAULT_WS)
        await kv.sadd(WS_INDEX, DEFAULT_WS.id)
        return res.status(200).json({ workspaces: [DEFAULT_WS] })
      }
      const items: any[] = []
      for (const id of ids) {
        const rec = (await kv.get(WS_PREFIX + id)) as any
        if (rec) items.push(rec)
      }
      return res.status(200).json({ workspaces: items })
    }

    if (req.method === 'POST' && action === 'ws:replace-all') {
      const list = (req.body?.workspaces || []) as any[]
      if (list.length === 0) {
        list.push(DEFAULT_WS)
      }
      const oldIds = (await kv.smembers(WS_INDEX)) as string[]
      for (const id of oldIds) {
        await kv.del(WS_PREFIX + id)
      }
      await kv.del(WS_INDEX)
      for (const rec of list) {
        await kv.set(WS_PREFIX + rec.id, rec)
        await kv.sadd(WS_INDEX, rec.id)
      }
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: { message: 'Unknown action' } })
  } catch (err: any) {
    return res.status(500).json({ error: { message: 'Server error', detail: String(err?.message || err) } })
  }
}