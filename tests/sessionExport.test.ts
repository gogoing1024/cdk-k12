import {
  assertWorkspaceSession,
  createSub2ApiExport,
  decodeJwtPayload,
} from '../src/lib/sessionExport.js'

function assertEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`)
  }
}

function assertDeepEqual(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual)
  const expectedJson = JSON.stringify(expected)
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, got ${actualJson}`)
  }
}

function assertThrows(fn: () => void, pattern: RegExp): void {
  try {
    fn()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!pattern.test(message)) {
      throw new Error(`Expected thrown message to match ${pattern}, got ${message}`)
    }
    return
  }
  throw new Error('Expected function to throw')
}

function base64Url(value: object): string {
  return btoa(JSON.stringify(value))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function fakeJwt(payload: object): string {
  return `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url(payload)}.sig`
}

const exportedAt = '2026-07-05T00:00:00.000Z'
const nowSeconds = Math.floor(Date.parse(exportedAt) / 1000)
const workspaceId = '11111111-2222-4333-8444-555555555555'
const accessToken = fakeJwt({
  exp: nowSeconds + 3600,
  'https://api.openai.com/auth': {
    chatgpt_account_id: workspaceId,
    chatgpt_user_id: 'user-123',
    chatgpt_plan_type: 'k12',
  },
  'https://api.openai.com/profile': {
    email: 'student@example.com',
  },
})

const session = {
  user: {
    id: 'user-top-level',
    email: 'fallback@example.com',
  },
  account: {
    id: workspaceId,
    planType: 'k12',
  },
  accessToken,
  authProvider: 'openai',
}

assertDeepEqual(decodeJwtPayload(accessToken), {
  accountId: workspaceId,
  accountUserId: '',
  email: 'student@example.com',
  planType: 'k12',
  chatgptUserId: 'user-123',
  userId: '',
  exp: nowSeconds + 3600,
})

const workspaceSession = assertWorkspaceSession(workspaceId, session)
assertEqual(workspaceSession.workspace?.id, workspaceId)
assertThrows(
  () => assertWorkspaceSession('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', session),
  /workspace mismatch/
)

assertDeepEqual(createSub2ApiExport([session], exportedAt, nowSeconds), {
  exported_at: exportedAt,
  proxies: [],
  accounts: [
    {
      name: 'fallback@example.com',
      platform: 'openai',
      type: 'oauth',
      auto_pause_on_expired: true,
      concurrency: 10,
      priority: 1,
      credentials: {
        access_token: accessToken,
        chatgpt_account_id: workspaceId,
        chatgpt_user_id: 'user-123',
        email: 'fallback@example.com',
        expires_in: 3600,
        plan_type: 'k12',
      },
      extra: {
        email: 'fallback@example.com',
        email_key: 'fallback_example_com',
        name: 'fallback@example.com',
        auth_provider: 'openai',
        source: 'chatgpt_web_session',
        last_refresh: exportedAt,
      },
    },
  ],
})

console.log('sessionExport tests passed')
