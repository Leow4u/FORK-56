/**
 * Select-workspace nested palette page.
 *
 * Recents are `$projectTree` (including Home). Open folder and New project
 * reuse the existing store actions. Remote is one extra action row — not a
 * tab or a recents store: already-remote connections open the in-app
 * RemoteFolderPicker via `openFolderAsProject`; local connections deep-link
 * to Settings → Gateway.
 */

export const SELECT_WORKSPACE_PAGE = 'workspace'

export const WORKSPACE_OPEN_FOLDER_ID = 'project-open-folder'
export const WORKSPACE_REMOTE_ID = 'project-remote'
export const WORKSPACE_NEW_PROJECT_ID = 'project-new'

export function workspaceProjectItemId(projectId: string): string {
  return `project-${projectId}`
}

export interface WorkspacePaletteProject {
  icon?: null | string
  id: string
  isNoProject?: boolean
  label: string
  path?: null | string
}

export interface WorkspacePaletteCopy {
  newProject: string
  newSessionInProject: (project: string) => string
  openFolder: string
  projects: string
  remote: string
}

export interface WorkspacePaletteHandlers {
  goToProject: (id: string, options?: { newSession?: boolean }) => void
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
  kind: 'new-project' | 'open-folder' | 'project' | 'remote'
  keywords: string[]
  label: string
  action?: string
  comboHint?: string
  icon?: null | string
  isNoProject?: boolean
  modLabel?: string
  projectId?: string
  run?: () => void
  runWithEvent?: (event?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) => void
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
  copy: Pick<WorkspacePaletteCopy, 'newProject' | 'openFolder' | 'remote'>,
  handlers: Pick<WorkspacePaletteHandlers, 'newProject' | 'openFolder' | 'openRemote'>
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

export function buildWorkspaceProjectItems(
  projects: readonly WorkspacePaletteProject[],
  copy: Pick<WorkspacePaletteCopy, 'newSessionInProject'>,
  handlers: Pick<WorkspacePaletteHandlers, 'goToProject'>
): WorkspacePaletteItem[] {
  return projects.map(project => ({
    comboHint: 'mod+enter',
    icon: project.icon,
    id: workspaceProjectItemId(project.id),
    isNoProject: project.isNoProject,
    kind: 'project' as const,
    keywords: ['project', 'workspace', 'go to', project.label, ...(project.path ? [project.path] : [])],
    label: project.label,
    modLabel: copy.newSessionInProject(project.label),
    projectId: project.id,
    runWithEvent: (event?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) =>
      handlers.goToProject(project.id, { newSession: Boolean(event?.metaKey || event?.ctrlKey) })
  }))
}

export function buildWorkspacePaletteGroups(
  projects: readonly WorkspacePaletteProject[],
  copy: WorkspacePaletteCopy,
  handlers: WorkspacePaletteHandlers
): WorkspacePaletteGroup[] {
  const actions: WorkspacePaletteGroup = {
    items: buildWorkspaceActionItems(copy, handlers)
  }

  const recents = buildWorkspaceProjectItems(projects, copy, handlers)

  if (recents.length === 0) {
    return [actions]
  }

  return [actions, { heading: copy.projects, items: recents }]
}
