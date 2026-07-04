export type AuthSession = {
  accessToken?: string
  sessionToken?: string
  authProvider?: string
  user?: {
    id?: string
    email?: string
    name?: string
  }
  account?: {
    id?: string
    planType?: string
  }
  workspace?: {
    requestedId?: string
    id?: string
    planType?: string
    email?: string
    exp?: number
    source?: string
  }
  [key: string]: unknown
}

export type DecodedAccessToken = {
  accountId: string
  accountUserId: string
  email: string
  planType: string
  chatgptUserId: string
  userId: string
  exp: number
}

export type Sub2ApiExport = {
  exported_at: string
  proxies: unknown[]
  accounts: Array<{
    name: string
    platform: 'openai'
    type: 'oauth'
    auto_pause_on_expired: true
    concurrency: number
    priority: number
    credentials: {
      access_token: string
      chatgpt_account_id: string
      chatgpt_user_id: string
      email: string
      expires_in: number
      plan_type: string
    }
    extra: {
      email: string
      email_key: string
      name: string
      auth_provider: string
      source: 'chatgpt_web_session'
      last_refresh: string
    }
  }>
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function decodeJwtPayload(accessToken?: string): DecodedAccessToken {
  try {
    const payload = String(accessToken || '').split('.')[1]
    if (!payload) return emptyDecodedAccessToken()

    const parsed = JSON.parse(decodeBase64Url(payload)) as Record<string, any>
    const auth = parsed['https://api.openai.com/auth'] || {}
    const profile = parsed['https://api.openai.com/profile'] || {}

    return {
      accountId: auth.chatgpt_account_id || '',
      accountUserId: auth.chatgpt_account_user_id || '',
      email: profile.email || '',
      planType: auth.chatgpt_plan_type || '',
      chatgptUserId: auth.chatgpt_user_id || '',
      userId: auth.user_id || '',
      exp: Number(parsed.exp) || 0,
    }
  } catch {
    return emptyDecodedAccessToken()
  }
}

function emptyDecodedAccessToken(): DecodedAccessToken {
  return {
    accountId: '',
    accountUserId: '',
    email: '',
    planType: '',
    chatgptUserId: '',
    userId: '',
    exp: 0,
  }
}

export function assertWorkspaceSession(workspaceId: string, session: AuthSession): AuthSession {
  const info = decodeJwtPayload(session.accessToken)
  if (!info.accountId) {
    throw new Error('workspace session accessToken is missing chatgpt_account_id')
  }
  if (info.accountId !== workspaceId) {
    throw new Error(`workspace mismatch: expected ${workspaceId}, got ${info.accountId}`)
  }

  return {
    ...session,
    workspace: {
      requestedId: workspaceId,
      id: info.accountId,
      planType: info.planType,
      email: info.email,
      exp: info.exp,
      source: 'accessToken',
    },
  }
}

function emailKey(email: string): string {
  return String(email || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function sessionEmail(session: AuthSession, info: DecodedAccessToken): string {
  return session.user?.email || info.email || ''
}

function sessionAccountId(session: AuthSession, info: DecodedAccessToken): string {
  return session.account?.id || info.accountId || ''
}

function sessionPlanType(session: AuthSession, info: DecodedAccessToken): string {
  return session.account?.planType || info.planType || ''
}

function sessionUserId(session: AuthSession, info: DecodedAccessToken): string {
  return info.chatgptUserId || info.userId || session.user?.id || ''
}

function createSub2ApiAccount(session: AuthSession, exportedAt: string, nowSeconds: number): Sub2ApiExport['accounts'][number] {
  const info = decodeJwtPayload(session.accessToken)
  const email = sessionEmail(session, info)
  const exp = Number(info.exp) || 0

  return {
    name: email,
    platform: 'openai',
    type: 'oauth',
    auto_pause_on_expired: true,
    concurrency: 10,
    priority: 1,
    credentials: {
      access_token: session.accessToken || '',
      chatgpt_account_id: sessionAccountId(session, info),
      chatgpt_user_id: sessionUserId(session, info),
      email,
      expires_in: Math.max(0, exp - nowSeconds),
      plan_type: sessionPlanType(session, info),
    },
    extra: {
      email,
      email_key: emailKey(email),
      name: email,
      auth_provider: session.authProvider || 'openai',
      source: 'chatgpt_web_session',
      last_refresh: exportedAt,
    },
  }
}

export function createSub2ApiExport(
  sessions: AuthSession[],
  exportedAt = new Date().toISOString(),
  nowSeconds = Math.floor(Date.parse(exportedAt) / 1000)
): Sub2ApiExport {
  return {
    exported_at: exportedAt,
    proxies: [],
    accounts: sessions.map(session => createSub2ApiAccount(session, exportedAt, nowSeconds)),
  }
}
