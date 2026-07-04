export type ActivationLogLevel = 'info' | 'success' | 'warning' | 'error'

export type ActivationLogEntry = {
  level: ActivationLogLevel
  message: string
  time: string
}

const TOKEN_PATTERN = /eyJ[A-Za-z0-9_-]{12,}(?:\.[A-Za-z0-9_-]{8,}){1,4}/g

export function redactLogMessage(message: string): string {
  return String(message || '').replace(TOKEN_PATTERN, '[redacted-token]')
}

export function createActivationLog(
  level: ActivationLogLevel,
  message: string,
  isoTime = new Date().toISOString()
): ActivationLogEntry {
  const date = new Date(isoTime)
  const time = Number.isNaN(date.getTime())
    ? new Date().toLocaleTimeString('en-GB', { hour12: false })
    : date.toLocaleTimeString('en-GB', { hour12: false })

  return {
    level,
    message: redactLogMessage(message),
    time,
  }
}
