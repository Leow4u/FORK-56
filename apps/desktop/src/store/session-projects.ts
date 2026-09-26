import { NO_PROJECT_ID } from '@/app/chat/sidebar/projects/workspace-groups'
import { computerFolderForSessionCwd } from '@/lib/attached-folder'
import type { ProjectInfo, SessionInfo } from '@/types/work4you'

import { $projectScope, $projectTree, ALL_PROJECTS } from './projects'

const STORAGE_KEY = 'work4you.desktop-session-projects'

type ProjectBySession = Record<string, string>

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function sessionProjectStorageKey(session: { connection_id?: null | string; id: string }): string {
  const home = session.connection_id?.trim() || 'local'

  return `${home}::${session.id}`
}

function readMap(): ProjectBySession {
  const raw = storage()?.getItem(STORAGE_KEY)

  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as ProjectBySession

    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(map: ProjectBySession): void {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(map))
}

/** The project the user is inside when a new chat is sent. Home and the overview are not a project. */
export function selectedProjectIdForNewChat(): null | string {
  const scope = $projectScope.get()

  if (!scope || scope === ALL_PROJECTS || scope === NO_PROJECT_ID) {
    return null
  }

  const project = $projectTree.get().find(node => node.id === scope)

  if (!project || project.isNoProject || project.archived) {
    return null
  }

  return scope
}

export function rememberSessionProject(
  session: { connection_id?: null | string; id: string },
  projectId: string
): void {
  const id = projectId.trim()

  if (!session.id || !id) {
    return
  }

  const map = readMap()

  map[sessionProjectStorageKey(session)] = id
  writeMap(map)
}

export function storedSessionProjectId(session: { connection_id?: null | string; id: string }): null | string {
  const id = readMap()[sessionProjectStorageKey(session)]?.trim()

  return id || null
}

/**
 * Old cloud copies were filed by path. Record the computer project once so later
 * refreshes follow the id and not `/attached/<name>`.
 */
export function rememberAttachedSessionProjects(sessions: SessionInfo[], projects: readonly ProjectInfo[]): void {
  for (const session of sessions) {
    if (session.desktop_project_id?.trim() || storedSessionProjectId(session)) {
      continue
    }

    const folder = computerFolderForSessionCwd(session.cwd || session.git_repo_root, projects)

    if (!folder) {
      continue
    }

    const project = projects.find(
      item => !item.archived && (item.primary_path === folder || item.folders.some(entry => entry.path === folder))
    )

    if (project) {
      rememberSessionProject(session, project.id)
    }
  }
}

/** Put the remembered project back on a row the gateway listed without it. */
export function withStoredProjectId<T extends SessionInfo>(session: T): T {
  if (session.desktop_project_id?.trim()) {
    return session
  }

  const stored = storedSessionProjectId(session)

  return stored ? { ...session, desktop_project_id: stored } : session
}
