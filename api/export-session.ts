import {
  assertWorkspaceSession,
  createSub2ApiExport,
  type AuthSession,
} from '../src/lib/sessionExport'
import {
  createActivationLog,
  type ActivationLogEntry,
} from '../src/lib/activationLog'
import {
  buildChatGptSessionHeaderAttempts,
  type ChatGptSessionHeaders,
} from '../src/lib/chatGptSessionRequest'

type ApiRequest = {
  method?: string
  body?: any
}

type ApiResponse = {
  setHeader: (key: string, value: string) => void
  status: (code: number) => {
    json: (body: any) => unknown
    end: () => unknown
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function setCors(res: ApiResponse): void {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => res.setHeader(key, value))
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function getSessionToken(session: AuthSession): string {
  const sessionToken = String(session.sessionToken || '').trim()
  if (!sessionToken) {
    throw new Error('Missing sessionToken in AuthSession')
  }
  return sessionToken
}

async function readJsonResponse(res: Response): Promise<any> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`ChatGPT returned non-JSON response: HTTP ${res.status}`)
  }
}

function workspaceLabel(workspaceId: string): string {
  return `${workspaceId.slice(0, 8)}...`
}

function pushLog(logs: ActivationLogEntry[], level: ActivationLogEntry['level'], message: string): void {
  logs.push(createActivationLog(level, message))
}

async function fetchWorkspaceSession(
  workspaceId: string,
  session: AuthSession,
  logs: ActivationLogEntry[]
): Promise<AuthSession> {
  const exchangeUrl = `https://chatgpt.com/api/auth/session?exchange_workspace_token=true&workspace_id=${encodeURIComponent(workspaceId)}&reason=setCurrentAccount`
  const attempts = buildChatGptSessionHeaderAttempts(getSessionToken(session), workspaceId)
  let lastError: Error | null = null

  pushLog(logs, 'info', `开始切换 workspace ${workspaceLabel(workspaceId)}`)
  for (const attempt of attempts) {
    pushLog(logs, 'info', `尝试 ${attempt.cookieName}，cookie header ${attempt.headers.cookie.length} bytes`)
    try {
      const workspaceSession = await fetchWorkspaceSessionWithHeaders(workspaceId, exchangeUrl, attempt.headers, logs)
      pushLog(logs, 'success', `${attempt.cookieName} 切换成功`)
      return workspaceSession
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      pushLog(logs, 'warning', `${attempt.cookieName} 失败：${lastError.message}`)
    }
  }

  throw lastError || new Error('Unable to fetch workspace AuthSession')
}

async function fetchWorkspaceSessionWithHeaders(
  workspaceId: string,
  exchangeUrl: string,
  headers: ChatGptSessionHeaders,
  logs: ActivationLogEntry[]
): Promise<AuthSession> {
  const exchangeRes = await fetch(exchangeUrl, {
    method: 'GET',
    headers,
    cache: 'no-store',
  })

  const exchangeJson = await readJsonResponse(exchangeRes)
  pushLog(logs, exchangeRes.ok ? 'success' : 'warning', `workspace exchange 返回 HTTP ${exchangeRes.status}`)
  if (!exchangeRes.ok) {
    const message = exchangeJson?.error?.message || exchangeJson?.error || `ChatGPT exchange HTTP ${exchangeRes.status}`
    throw new Error(String(message))
  }

  try {
    const checked = assertWorkspaceSession(workspaceId, exchangeJson as AuthSession)
    pushLog(logs, 'success', 'exchange session workspace 校验通过')
    return checked
  } catch {
    pushLog(logs, 'info', 'exchange 响应未直接命中目标 workspace，继续读取最新 AuthSession')
    const sessionRes = await fetch('https://chatgpt.com/api/auth/session', {
      method: 'GET',
      headers,
      cache: 'no-store',
    })
    const sessionJson = await readJsonResponse(sessionRes)
    pushLog(logs, sessionRes.ok ? 'success' : 'warning', `AuthSession 读取返回 HTTP ${sessionRes.status}`)
    if (!sessionRes.ok) {
      const message = sessionJson?.error?.message || sessionJson?.error || `ChatGPT session HTTP ${sessionRes.status}`
      throw new Error(String(message))
    }
    const checked = assertWorkspaceSession(workspaceId, sessionJson as AuthSession)
    pushLog(logs, 'success', '最新 AuthSession workspace 校验通过')
    return checked
  }
}

function exportFileName(email: string, exportedAt: string): string {
  const safeEmail = String(email || 'account')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const stamp = exportedAt.replace(/[:.]/g, '-')
  return `sub2api-k12-${safeEmail || 'account'}-${stamp}.json`
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const logs: ActivationLogEntry[] = []

  if (req.method === 'OPTIONS') {
    setCors(res)
    return res.status(204).end()
  }

  setCors(res)

  if (req.method !== 'POST') {
    pushLog(logs, 'error', '导出接口方法不被允许')
    return res.status(405).json({ error: { message: 'Method Not Allowed' }, logs })
  }

  try {
    const workspaceId = String(req.body?.workspaceId || '').trim()
    const inputSession = req.body?.session as AuthSession | undefined

    if (!workspaceId || !isUuid(workspaceId)) {
      pushLog(logs, 'error', 'workspaceId 格式无效')
      return res.status(400).json({ error: { message: 'Invalid workspaceId' }, logs })
    }
    if (!inputSession || typeof inputSession !== 'object' || !inputSession.accessToken) {
      pushLog(logs, 'error', 'AuthSession 数据无效')
      return res.status(400).json({ error: { message: 'Invalid AuthSession' }, logs })
    }

    pushLog(logs, 'info', '开始生成下载 JSON')
    const workspaceSession = await fetchWorkspaceSession(workspaceId, inputSession, logs)
    const exportedAt = new Date().toISOString()
    const exportJson = createSub2ApiExport([workspaceSession], exportedAt)
    const email = exportJson.accounts[0]?.credentials.email || ''
    pushLog(logs, 'success', 'sub2api JSON 生成完成')

    return res.status(200).json({
      ok: true,
      fileName: exportFileName(email, exportedAt),
      exportJson,
      logs,
    })
  } catch (err: any) {
    pushLog(logs, 'error', String(err?.message || err))
    return res.status(502).json({
      error: {
        message: 'Workspace session export failed',
        detail: String(err?.message || err),
      },
      logs,
    })
  }
}
