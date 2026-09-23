/**
 * Select-workspace actions and the recent-project list.
 *
 * The project rows are the sidebar's `$projectTree` (same sort, same
 * dismissals) — not a second catalog. Home and archived rows stay out, and
 * auto-discovered repos with no sessions stay out so the menu is not a disk
 * scan. Open folder and New project reuse the existing store actions.
 * Gateway / Cloud / SSH connections stay in Settings → Gateways.
 * The composer chip menu and the ⌘K nested page both render these rows.
 */

import { orderProjectsByIds, sortProjectsForOverview } from '@/app/chat/sidebar/projects/model'
import { NO_PROJECT_ID, type SidebarProjectTree } from '@/app/chat/sidebar/projects/workspace-groups'
import { isUnderPath } from '@/lib/path-compare'
import { normalize } from '@/lib/text'
import { filterVisibleProjects } from '@/store/layout'
import {
  ALL_PROJECTS,
  clearActiveWorkspace,
  openFolderAsProject,
  openProjectCreate,
  projectRootCwd,
  selectWorkspaceProject
} from '@/store/projects'

export const SELECT_WORKSPACE_PAGE = 'workspace'

export const WORKSPACE_OPEN_FOLDER_ID = 'project-open-folder'
export const WORKSPACE_NEW_PROJECT_ID = 'project-new'
export const WORKSPACE_CLEAR_ACTIVE_ID = 'project-clear-active'

export interface WorkspacePaletteCopy {
  clearActive: string
  newProject: string
  openFolder: string
}

export interface WorkspacePaletteHandlers {
  clearActive: () => void
  newProject: () => void
  openFolder: () => void
  selectProject: (id: string) => void
}

export interface WorkspacePaletteItem {
  id: string
  kind: 'clear-active' | 'new-project' | 'open-folder' | 'project'
  keywords: string[]
  label: string
  active?: boolean
  action?: string
  run?: () => void
}

export interface WorkspacePaletteGroup {
  heading?: string
  items: WorkspacePaletteItem[]
}

/** The sidebar tree, as the chip menu and the ⌘K page should list it. */
export interface WorkspacePickerSource {
  /** Durable active project. Floats that row, matching the sidebar overview. */
  activeProjectId?: null | string
  cwd?: null | string
  dismissedIds?: readonly string[]
  orderIds?: readonly string[]
  projects: readonly SidebarProjectTree[]
  /** Client filter. The ⌘K page leaves this empty and ranks with its own query. */
  query?: string
  scope?: string
}

/** Same Open folder / New project / recent-project wiring both surfaces share. */
export function createWorkspacePaletteHandlers(): WorkspacePaletteHandlers {
  return {
    clearActive: clearActiveWorkspace,
    newProject: openProjectCreate,
    openFolder: () => {
      void openFolderAsProject()
    },
    selectProject: selectWorkspaceProject
  }
}

function isPickerProject(project: SidebarProjectTree): boolean {
  if (project.isNoProject || project.archived) {
    return false
  }

  // A git checkout the scan found, and nobody has worked in, is not a recent.
  if (project.isAuto && project.sessionCount <= 0) {
    return false
  }

  return Boolean(projectRootCwd(project))
}

function namedProjectIdForCwd(projects: readonly SidebarProjectTree[], cwd: string): null | string {
  const target = cwd.trim()

  if (!target) {
    return null
  }

  let best: null | string = null
  let bestLen = -1

  for (const project of projects) {
    if (project.isAuto || project.isNoProject || project.archived) {
      continue
    }

    const paths = [project.path, ...project.repos.flatMap(repo => [repo.path, ...repo.groups.map(group => group.path)])]

    for (const path of paths) {
      const candidate = (path || '').trim()

      if (candidate && isUnderPath(candidate, target) && candidate.length > bestLen) {
        bestLen = candidate.length
        best = project.id
      }
    }
  }

  return best
}

/** The row the chip is showing: the entered project, else the named project on the cwd. */
export function activeWorkspaceProjectId(source: WorkspacePickerSource): null | string {
  const scope = source.scope ?? ALL_PROJECTS

  const entered =
    scope !== ALL_PROJECTS &&
    scope !== NO_PROJECT_ID &&
    source.projects.some(project => project.id === scope && !project.isNoProject)

  if (entered) {
    return scope
  }

  return namedProjectIdForCwd(source.projects, source.cwd ?? '')
}

export function workspacePickerProjects(source: WorkspacePickerSource): SidebarProjectTree[] {
  const visible = filterVisibleProjects(source.projects, source.dismissedIds).filter(isPickerProject)

  const ordered = orderProjectsByIds(sortProjectsForOverview(visible, source.activeProjectId ?? null), [
    ...(source.orderIds ?? [])
  ])

  const terms = normalize(source.query).split(/\s+/).filter(Boolean)

  if (!terms.length) {
    return ordered
  }

  return ordered.filter(project => {
    const hay = `${normalize(project.label)} ${normalize(project.path)}`

    return terms.every(term => hay.includes(term))
  })
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

function buildProjectItems(source: WorkspacePickerSource, handlers: WorkspacePaletteHandlers): WorkspacePaletteItem[] {
  const activeId = activeWorkspaceProjectId(source)

  return workspacePickerProjects(source).map(project => ({
    active: project.id === activeId,
    id: `project:${project.id}`,
    kind: 'project' as const,
    keywords: ['project', 'workspace', 'recent', 'folder', project.label, project.path ?? ''],
    label: project.label,
    run: () => handlers.selectProject(project.id)
  }))
}

export function buildWorkspacePaletteGroups(
  copy: WorkspacePaletteCopy,
  handlers: WorkspacePaletteHandlers,
  source?: WorkspacePickerSource
): WorkspacePaletteGroup[] {
  const projects = source ? buildProjectItems(source, handlers) : []
  const groups: WorkspacePaletteGroup[] = []

  if (projects.length) {
    groups.push({ items: projects })
  }

  groups.push({ items: buildWorkspaceActionItems(copy, handlers) })

  if (source && activeWorkspaceProjectId(source)) {
    groups.push({
      items: [
        {
          id: WORKSPACE_CLEAR_ACTIVE_ID,
          kind: 'clear-active',
          keywords: ['clear', 'active', 'detach', 'none', 'workspace', 'reset'],
          label: copy.clearActive,
          run: handlers.clearActive
        }
      ]
    })
  }

  return groups
}
