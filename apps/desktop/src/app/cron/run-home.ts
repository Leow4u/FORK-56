export type CronRunHome = 'cloud' | 'device'

export function cronRunHomeOptions(canUseCloud: boolean | null): CronRunHome[] {
  return canUseCloud === true ? ['device', 'cloud'] : ['device']
}

/** An existing job stays on the connection that already stores it. */
export function lockedCronRunHome(mode: string | undefined, remoteKind: string | undefined): CronRunHome {
  return mode === 'remote' && remoteKind === 'cloud' ? 'cloud' : 'device'
}

export function cronCreateConnectionId(
  home: CronRunHome,
  connections: Array<{ id: string; kind?: string }> | undefined
): string | undefined {
  const kind = home === 'cloud' ? 'cloud' : 'local'

  return connections?.find(connection => connection.kind === kind)?.id
}

export function projectFolderForScope(
  scope: string | null | undefined,
  projects: Array<{ id: string; path?: null | string }>
): string | null {
  const id = scope?.trim()

  if (!id || id === 'all') {
    return null
  }

  const folder = projects.find(project => project.id === id)?.path?.trim()

  return folder || null
}

/**
 * Device jobs use the computer folder. Cloud jobs use only a delivered copy.
 * A missing delivery does not fall back to the live computer path.
 */
export function cronWorkdir(home: CronRunHome, folder: string | null, delivered: string | null): string | undefined {
  if (home === 'device') {
    return folder?.trim() || undefined
  }

  return delivered?.trim() || undefined
}

const DELIVER_MAX_FILES = 200

async function collectFolderFiles(
  desktop: NonNullable<Window['work4youDesktop']>,
  root: string,
  dir: string,
  depth: number,
  files: Array<{ content: string; path: string }>
): Promise<void> {
  if (depth > 6 || files.length >= DELIVER_MAX_FILES || !desktop.readDir || !desktop.readFileText) {
    return
  }

  const listed = await desktop.readDir(dir)
  const normRoot = root.replace(/\\/g, '/').replace(/\/+$/, '')

  for (const entry of listed.entries ?? []) {
    if (files.length >= DELIVER_MAX_FILES) {
      return
    }

    if (entry.isDirectory) {
      await collectFolderFiles(desktop, root, entry.path, depth + 1, files)

      continue
    }

    const normFile = entry.path.replace(/\\/g, '/')
    const rel = normFile.startsWith(`${normRoot}/`) ? normFile.slice(normRoot.length + 1) : ''

    if (!rel || rel.split('/').some(part => part === '..' || part.startsWith('.'))) {
      continue
    }

    try {
      const text = await desktop.readFileText(entry.path)

      if (!text.binary) {
        files.push({ content: text.text, path: rel })
      }
    } catch {
      // Skip files this computer cannot read as text.
    }
  }
}

/** Send the project folder to the cloud machine. Returns the remote path, or null. */
export async function deliverCronFolder(localPath: string, connectionId: string | undefined): Promise<string | null> {
  const desktop = window.work4youDesktop
  const root = localPath.trim()

  if (!desktop?.api || !root) {
    return null
  }

  const files: Array<{ content: string; path: string }> = []

  try {
    await collectFolderFiles(desktop, root, root, 0, files)
    const key = root.replace(/[/\\]+$/, '').split(/[/\\]/).pop() || 'folder'

    const result = await desktop.api<{ path?: string }>({
      body: { files, folder_key: key },
      connectionId,
      method: 'POST',
      path: '/api/fs/attach-folder'
    })

    return result.path || null
  } catch {
    return null
  }
}
