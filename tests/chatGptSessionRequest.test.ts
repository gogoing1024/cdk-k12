import {
  buildChatGptSessionHeaders,
  buildChatGptSessionHeaderAttempts,
  buildSessionCookie,
} from '../src/lib/chatGptSessionRequest.js'

function assertIncludes(actual: string, expected: string): void {
  if (!actual.includes(expected)) {
    throw new Error(`Expected ${JSON.stringify(actual)} to include ${JSON.stringify(expected)}`)
  }
}

function assertNotIncludes(actual: string, expected: string): void {
  if (actual.includes(expected)) {
    throw new Error(`Expected ${JSON.stringify(actual)} not to include ${JSON.stringify(expected)}`)
  }
}

function assertEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`)
  }
}

function cookieNames(cookie: string): string[] {
  return cookie.split('; ').map(part => part.split('=')[0] || '')
}

function assertCookieName(cookie: string, name: string): void {
  if (!cookieNames(cookie).includes(name)) {
    throw new Error(`Expected cookie ${JSON.stringify(cookie)} to include cookie name ${name}`)
  }
}

function assertNoCookieName(cookie: string, name: string): void {
  if (cookieNames(cookie).includes(name)) {
    throw new Error(`Expected cookie ${JSON.stringify(cookie)} not to include cookie name ${name}`)
  }
}

const sessionToken = 'session-token-value'
const workspaceId = 'ff598c4d-1111-4222-8333-444444444444'
const cookie = buildSessionCookie(sessionToken, workspaceId)

assertIncludes(cookie, `__Secure-next-auth.session-token=${encodeURIComponent(sessionToken)}`)
assertNoCookieName(cookie, 'next-auth.session-token')
assertNoCookieName(cookie, '__Secure-authjs.session-token')
assertNoCookieName(cookie, 'authjs.session-token')
assertIncludes(cookie, `_account=${encodeURIComponent(workspaceId)}`)

const longSessionToken = 'x'.repeat(5000)
const longCookie = buildSessionCookie(longSessionToken, workspaceId)
assertIncludes(longCookie, `__Secure-next-auth.session-token.0=${'x'.repeat(3800)}`)
assertIncludes(longCookie, `__Secure-next-auth.session-token.1=${'x'.repeat(1200)}`)
assertNotIncludes(longCookie, `__Secure-authjs.session-token.0=${'x'.repeat(3800)}`)
assertNotIncludes(longCookie, `authjs.session-token.1=${'x'.repeat(1200)}`)
assertNotIncludes(longCookie, `__Secure-next-auth.session-token=${longSessionToken}`)
if (longCookie.length > 6200) {
  throw new Error(`Expected compact cookie header, got ${longCookie.length} bytes`)
}

const headers = buildChatGptSessionHeaders(sessionToken, workspaceId)
assertEqual(headers.accept, '*/*')
assertEqual(headers.origin, 'https://chatgpt.com')
assertEqual(headers.referer, 'https://chatgpt.com/')
assertEqual(headers['x-openai-target-path'], '/api/auth/session')
assertEqual(headers['x-openai-target-route'], '/api/auth/session')
assertIncludes(headers.cookie, '_account=')

const attempts = buildChatGptSessionHeaderAttempts(sessionToken, workspaceId)
assertEqual(attempts.length, 4)
assertIncludes(attempts[0].headers.cookie, '__Secure-next-auth.session-token=')
assertIncludes(attempts[1].headers.cookie, '__Secure-authjs.session-token=')
assertCookieName(attempts[2].headers.cookie, 'next-auth.session-token')
assertCookieName(attempts[3].headers.cookie, 'authjs.session-token')
assertNoCookieName(attempts[0].headers.cookie, '__Secure-authjs.session-token')

console.log('chatGptSessionRequest tests passed')
