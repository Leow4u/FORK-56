/**
 * Select-workspace actions.
 *
 * The unique project tree lives in Sidebar → Projects. This list is the
 * open/create/connect surface only: Open folder, Remote, and New project
 * reuse the existing store actions. No second copy of `$projectTree`.
 * The composer chip menu and the ⌘K nested page both render these rows.
 */

import { isDesktopFsRemoteMode } from '@/lib/desktop-fs'
import { openFolderAsProject, openProjectCreate } from '@/store/projects'

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

/** Same Open folder / Remote / New project wiring the chip menu and ⌘K page share. */
export function createWorkspacePaletteHandlers(openGatewaySettings: () => void): WorkspacePaletteHandlers {
  return {
    newProject: openProjectCreate,
    openFolder: () => {
      void openFolderAsProject()
    },
    openRemote: () => {
      runWorkspaceRemoteAction(isDesktopFsRemoteMode(), {
        openGatewaySettings,
        openRemoteFolder: () => {
          void openFolderAsProject()
        }
      })
    }
  }
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
