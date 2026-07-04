export type ChatGptSessionHeaders = {
  accept: string
  'accept-language': string
  'cache-control': string
  pragma: string
  cookie: string
  origin: string
  referer: string
  'oai-language': string
  'user-agent': string
  'sec-fetch-dest': string
  'sec-fetch-mode': string
  'sec-fetch-site': string
  'x-openai-target-path': string
  'x-openai-target-route': string
}

export type ChatGptSessionHeaderAttempt = {
  cookieName: string
  headers: ChatGptSessionHeaders
}

const SESSION_COOKIE_CHUNK_SIZE = 3800
const SESSION_COOKIE_NAMES = [
  '__Secure-next-auth.session-token',
  '__Secure-authjs.session-token',
  'next-auth.session-token',
  'authjs.session-token',
]

function cookieValue(value: string): string {
  return encodeURIComponent(value)
}

function sessionCookieParts(name: string, encodedToken: string): string[] {
  if (encodedToken.length <= SESSION_COOKIE_CHUNK_SIZE) {
    return [`${name}=${encodedToken}`]
  }

  const parts: string[] = []
  for (let offset = 0; offset < encodedToken.length; offset += SESSION_COOKIE_CHUNK_SIZE) {
    const index = parts.length
    const chunk = encodedToken.slice(offset, offset + SESSION_COOKIE_CHUNK_SIZE)
    parts.push(`${name}.${index}=${chunk}`)
  }
  return parts
}

export function buildSessionCookie(
  sessionToken: string,
  workspaceId: string,
  sessionCookieName = SESSION_COOKIE_NAMES[0]
): string {
  const encodedToken = cookieValue(sessionToken)
  const encodedWorkspace = cookieValue(workspaceId)

  return [
    ...sessionCookieParts(sessionCookieName, encodedToken),
    `_account=${encodedWorkspace}`,
  ].join('; ')
}

export function buildChatGptSessionHeaders(
  sessionToken: string,
  workspaceId: string,
  sessionCookieName = SESSION_COOKIE_NAMES[0]
): ChatGptSessionHeaders {
  return {
    accept: '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
    pragma: 'no-cache',
    cookie: buildSessionCookie(sessionToken, workspaceId, sessionCookieName),
    origin: 'https://chatgpt.com',
    referer: 'https://chatgpt.com/',
    'oai-language': 'en-US',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'x-openai-target-path': '/api/auth/session',
    'x-openai-target-route': '/api/auth/session',
  }
}

export function buildChatGptSessionHeaderAttempts(
  sessionToken: string,
  workspaceId: string
): ChatGptSessionHeaderAttempt[] {
  return SESSION_COOKIE_NAMES.map(cookieName => ({
    cookieName,
    headers: buildChatGptSessionHeaders(sessionToken, workspaceId, cookieName),
  }))
}
