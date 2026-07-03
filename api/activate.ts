import type { VercelRequest, VercelResponse } from '@vercel/node'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return res.end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } })
  }

  const body = (req.body || {}) as { workspaceId?: string; accessToken?: string }
  const workspaceId = String(body.workspaceId || '').trim()
  const accessToken = String(body.accessToken || '').trim()

  if (!workspaceId || !accessToken) {
    return res.status(400).json({ error: { message: 'Missing workspaceId or accessToken' } })
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidPattern.test(workspaceId)) {
    return res.status(400).json({ error: { message: 'Invalid workspaceId format' } })
  }

  const targetUrl = `https://chatgpt.com/backend-api/accounts/${workspaceId}/invites/request`

  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'oai-language': (req.headers['oai-language'] as string) || 'en-US',
        'user-agent': (req.headers['user-agent'] as string) || 'Mozilla/5.0',
      },
      body: '',
    })

    const text = await upstream.text()
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
    return res.status(upstream.status).send(text)
  } catch (err: any) {
    return res.status(502).json({
      error: { message: 'Upstream request failed', detail: String(err?.message || err) },
    })
  }
}