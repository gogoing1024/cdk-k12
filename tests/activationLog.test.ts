import {
  createActivationLog,
  redactLogMessage,
  type ActivationLogLevel,
} from '../src/lib/activationLog.js'

function assertEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`)
  }
}

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

const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.signature-value'
const sessionToken = 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0.super-secret-session-token'
const message = `Request failed with token ${jwt} and session ${sessionToken}`
const redacted = redactLogMessage(message)

assertIncludes(redacted, '[redacted-token]')
assertNotIncludes(redacted, jwt)
assertNotIncludes(redacted, sessionToken)

const level: ActivationLogLevel = 'success'
const entry = createActivationLog(level, 'Workspace export completed', '2026-07-05T01:02:03.000Z')
const expectedLocalTime = new Date('2026-07-05T01:02:03.000Z')
  .toLocaleTimeString('en-GB', { hour12: false })

assertEqual(entry.level, 'success')
assertEqual(entry.message, 'Workspace export completed')
assertEqual(entry.time, expectedLocalTime)

console.log('activationLog tests passed')
