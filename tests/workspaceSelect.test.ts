import { formatWorkspaceLabel } from '../src/admin/workspaceSelect.js'

function assertEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`)
  }
}

assertEqual(
  formatWorkspaceLabel({
    name: 'Gmail Workspace NO.2',
    workspaceId: 'ff598c4d-1111-4222-8333-444444444444',
  }),
  'Gmail Workspace NO.2 - ff598c4d...'
)

assertEqual(
  formatWorkspaceLabel({
    name: '',
    workspaceId: 'eb6642e8-b4a6-4652-9c18-67099f2781cc',
  }),
  'eb6642e8...'
)

console.log('workspaceSelect tests passed')
