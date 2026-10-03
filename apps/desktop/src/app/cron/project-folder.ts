import { ALL_PROJECTS } from '@/store/project-scope'

/**
 * Folder a new scheduled job runs in: the project the sidebar is scoped to, so
 * the job loads that folder's AGENTS.md. Only on the local backend, because a
 * remote machine does not have this computer's folders. All projects, Home, or
 * a project without a folder: no folder, and the job runs where the backend
 * defaults.
 */
export function cronProjectFolder(
  scope: null | string | undefined,
  projects: ReadonlyArray<{ id: string; path?: null | string }>,
  remote: boolean
): null | string {
  const id = scope?.trim()

  if (remote || !id || id === ALL_PROJECTS) {
    return null
  }

  const folder = projects.find(project => project.id === id)?.path?.trim()

  return folder || null
}
