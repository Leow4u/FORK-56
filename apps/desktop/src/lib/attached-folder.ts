/** A folder the user picked on this computer, not a path on the cloud machine. */
export function isComputerProjectPath(path: string | null | undefined): boolean {
  const trimmed = path?.trim()

  if (!trimmed) {
    return false
  }

  return !trimmed.replace(/\\/g, '/').includes('/opt/work4you')
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
