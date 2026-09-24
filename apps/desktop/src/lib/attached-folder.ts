/** A folder the user picked on this computer, not a path on the cloud machine. */
export function isComputerProjectPath(path: string | null | undefined): boolean {
  const trimmed = path?.trim()

  if (!trimmed) {
    return false
  }

  return !trimmed.replace(/\\/g, '/').includes('/opt/work4you')
}

/** First folder name under a machine copy (`…/attached/<key>`). */
export function attachmentKeyFromRemotePath(path: string | null | undefined): string | null {
  const norm = (path ?? '').trim().replace(/\\/g, '/')
  const marker = '/attached/'
  const idx = norm.toLowerCase().indexOf(marker)

  if (idx < 0) {
    return null
  }

  const segment = norm
    .slice(idx + marker.length)
    .split('/')
    .filter(Boolean)[0]

  return segment || null
}

/** Computer folder whose copy key matches a cloud session cwd. Ambiguous keys stay unresolved. */
export function computerFolderForSessionCwd(
  cwd: string | null | undefined,
  projects: Array<{ folders?: Array<{ path?: string | null }> }>
): string | null {
  const key = attachmentKeyFromRemotePath(cwd)

  if (!key) {
    return null
  }

  const matches = new Set<string>()

  for (const project of projects) {
    for (const folder of project.folders ?? []) {
      const path = folder.path?.trim()

      if (path && isComputerProjectPath(path) && attachmentFolderKey(path) === key) {
        matches.add(path)
      }
    }
  }

  return matches.size === 1 ? [...matches][0] : null
}

export function attachmentFolderKey(path: string): string {
  const base =
    path
      .replace(/[/\\]+$/, '')
      .split(/[/\\]/)
      .pop() || 'folder'

  return base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '') || 'folder'
}

export function safeAttachRelative(root: string, filePath: string): string | null {
  const normRoot = root.replace(/\\/g, '/').replace(/\/+$/, '')
  const normFile = filePath.replace(/\\/g, '/')

  if (normFile !== normRoot && !normFile.startsWith(`${normRoot}/`)) {
    return null
  }

  const rel = normFile.slice(normRoot.length).replace(/^\/+/, '')

  if (!rel || rel.split('/').some(part => part === '..' || part.startsWith('.'))) {
    return null
  }

  return rel
}
