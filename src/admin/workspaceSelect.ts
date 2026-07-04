export type WorkspaceOption = {
  id?: string
  name: string
  workspaceId: string
}

export function formatWorkspaceLabel(workspace: Pick<WorkspaceOption, 'name' | 'workspaceId'>): string {
  const shortId = `${workspace.workspaceId.slice(0, 8)}...`
  const name = workspace.name.trim()
  return name ? `${name} - ${shortId}` : shortId
}
