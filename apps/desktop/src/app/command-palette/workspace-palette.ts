/**
 * Select-workspace actions.
 *
 * The unique project tree lives in Sidebar → Projects. This list is the
 * open/create surface only: Open folder and New project reuse the existing
 * store actions. Gateway / Cloud / SSH connections stay in Settings →
 * Gateways — this menu does not offer Remote. No second copy of `$projectTree`.
 * The composer chip menu and the ⌘K nested page both render these rows.
 */

import { openFolderAsProject, openProjectCreate } from '@/store/projects'

export const SELECT_WORKSPACE_PAGE = 'workspace'

export const WORKSPACE_OPEN_FOLDER_ID = 'project-open-folder'
export const WORKSPACE_NEW_PROJECT_ID = 'project-new'

export interface WorkspacePaletteCopy {
  newProject: string
  openFolder: string
}

export interface WorkspacePaletteHandlers {
  newProject: () => void
  openFolder: () => void
}

export interface WorkspacePaletteItem {
  id: string
  kind: 'new-project' | 'open-folder'
  keywords: string[]
  label: string
  action?: string
  run?: () => void
}

export interface WorkspacePaletteGroup {
  heading?: string
  items: WorkspacePaletteItem[]
}

/** Same Open folder / New project wiring the chip menu and ⌘K page share. */
export function createWorkspacePaletteHandlers(): WorkspacePaletteHandlers {
  return {
    newProject: openProjectCreate,
    openFolder: () => {
      void openFolderAsProject()
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
