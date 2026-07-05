// CDK Key statuses
export type CDKStatus = 'live' | 'used' | 'disabled'

// A CDK Key record
export interface CDKKey {
  id: string
  key: string           // The CDK activation key string
  workspaceId: string  // Workspace ID to use for activation API
  status: CDKStatus
  createdAt: number    // timestamp
  activatedAt?: number  // timestamp when activated
  activatedEmail?: string // email that used this key
}

// A Workspace record
export interface Workspace {
  id: string
  name: string
  workspaceId: string // The actual workspace ID (UUID)
  isDefault: boolean
  createdAt: number
}

// Admin session — credentials are stored server-side only (see api/auth.ts)
export interface AdminSession {
  isLoggedIn: boolean
  username: string
  loginAt: number
}

// Storage keys
export const STORAGE_KEYS = {
  CDK_KEYS: 'cdk_admin_keys',
  WORKSPACES: 'cdk_admin_workspaces',
  ADMIN_SESSION: 'cdk_admin_session',
} as const

// Default workspace ID
export const DEFAULT_WORKSPACE_ID = '5e4c9b31-1b4e-4887-839b-607597928d7c'

// Generate a random CDK key (format: XXXX-XXXX-XXXX)
export function generateCDKKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const parts = [4, 4, 4].map(len =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  )
  return parts.join('-')
}

// Generate a UUID
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// Format timestamp to readable date
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Status label helpers
export const STATUS_LABELS: Record<CDKStatus, { zh: string; en: string; color: string }> = {
  live: {
    zh: '未使用',
    en: 'Live',
    color: 'text-emerald-400',
  },
  used: {
    zh: '已使用',
    en: 'Used',
    color: 'text-slate-400',
  },
  disabled: {
    zh: '已禁用',
    en: 'Disabled',
    color: 'text-red-400',
  },
}
