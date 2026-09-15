/**
 * Select-workspace nested palette page.
 *
 * The unique project tree lives in Sidebar → Projects. This page is the
 * open/create/connect surface only: Open folder, Remote, and New project
 * reuse the existing store actions. No second copy of `$projectTree`.
 */

export const SELECT_WORKSPACE_PAGE = 'workspace'

export const WORKSPACE_OPEN_FOLDER_ID = 'project-open-folder'
export const WORKSPACE_REMOTE_ID = 'project-remote'
export const WORKSPACE_NEW_PROJECT_ID = 'project-new'

export interface WorkspacePaletteCopy {
  newProject: string
  openFolder: string
  remote: string
}

export interface WorkspacePaletteHandlers {
  newProject: () => void
  openFolder: () => void
  openRemote: () => void
}

export interface WorkspaceRemoteHandlers {
  openGatewaySettings: () => void
  openRemoteFolder: () => void
}

export type WorkspaceRemoteTarget = 'gateway-settings' | 'open-remote-folder'

export interface WorkspacePaletteItem {
  id: string
  kind: 'new-project' | 'open-folder' | 'remote'
  keywords: string[]
  label: string
  action?: string
  run?: () => void
}

export interface WorkspacePaletteGroup {
  heading?: string
  items: WorkspacePaletteItem[]
}

/** Already on a remote gateway → browse its folders. Otherwise → Settings → Gateway. */
export function workspaceRemoteTarget(isRemote: boolean): WorkspaceRemoteTarget {
  return isRemote ? 'open-remote-folder' : 'gateway-settings'
}

export function runWorkspaceRemoteAction(isRemote: boolean, handlers: WorkspaceRemoteHandlers): void {
  if (workspaceRemoteTarget(isRemote) === 'open-remote-folder') {
    handlers.openRemoteFolder()

    return
  }

  handlers.openGatewaySettings()
}

export function buildWorkspaceActionItems(
  copy: WorkspacePaletteCopy,
  handlers: WorkspacePaletteHandlers
): WorkspacePaletteItem[] {
  return [
    {
      action: 'workspace.openFolder',
      id: WORKSPACE_OPEN_FOLDER_ID,
      kind: 'open-folder',
      keywords: ['open', 'folder', 'directory', 'project', 'add', 'import', 'workspace'],
      label: copy.openFolder,
      run: handlers.openFolder
    },
    {
      id: WORKSPACE_REMOTE_ID,
      kind: 'remote',
      keywords: ['remote', 'ssh', 'cloud', 'gateway', 'folder', 'connect', 'server', 'workspace'],
      label: copy.remote,
      run: handlers.openRemote
    },
    {
      id: WORKSPACE_NEW_PROJECT_ID,
      kind: 'new-project',
      keywords: ['new', 'project', 'create', 'workspace', 'folder'],
      label: copy.newProject,
      run: handlers.newProject
    }
  ]
}

export function buildWorkspacePaletteGroups(
  copy: WorkspacePaletteCopy,
  handlers: WorkspacePaletteHandlers
): WorkspacePaletteGroup[] {
  return [{ items: buildWorkspaceActionItems(copy, handlers) }]
}
