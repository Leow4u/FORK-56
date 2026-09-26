/** A project the desktop catalog can own. Archived rows are not a home. */
export type ProjectMembership = {
  archived?: boolean
  id: string
}

/**
 * The project a chat belongs to when it was born inside one.
 *
 * The id is authoritative. A cloud path, an empty cwd, or a folder that also
 * matches another project must not move the row. An id that is not in the
 * catalog is not a membership — callers keep their older path rules only when
 * the chat never recorded a project.
 */
export function membershipProjectId(
  session: { desktop_project_id?: null | string },
  projects: readonly ProjectMembership[]
): null | string {
  const id = session.desktop_project_id?.trim() ?? ''

  if (!id) {
    return null
  }

  const project = projects.find(item => item.id === id)

  if (!project || project.archived) {
    return null
  }

  return id
}
