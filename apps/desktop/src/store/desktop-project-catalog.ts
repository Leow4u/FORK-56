import type { ProjectInfo } from '@/types/work4you'

/** A path that belongs to the hosted machine, not a folder on this computer. */
export function isHostedProjectPath(path: null | string | undefined): boolean {
  const norm = (path ?? '').replace(/\\/g, '/').toLowerCase()

  if (!norm) {
    return false
  }

  return norm.includes('/opt/work4you') || norm.includes('/attached/')
}

/** Folderless projects stay. A hosted copy of a folder does not. */
export function isComputerCatalogProject(project: {
  folders?: Array<{ path?: null | string }>
  primary_path?: null | string
}): boolean {
  const path = project.primary_path || project.folders?.find(folder => folder.path)?.path

  return !isHostedProjectPath(path)
}

const STORAGE_KEY = 'work4you.desktop-projects'

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function readDesktopProjectCatalog(): ProjectInfo[] {
  const raw = storage()?.getItem(STORAGE_KEY)

  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as ProjectInfo[]

    return Array.isArray(parsed) ? parsed.filter(project => project && typeof project.id === 'string') : []
  } catch {
    return []
  }
}

export function forgetDesktopProject(id: string): void {
  const next = readDesktopProjectCatalog().filter(project => project.id !== id)

  storage()?.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function rememberDesktopProjects(projects: ProjectInfo[]): void {
  const byId = new Map(
    readDesktopProjectCatalog()
      .filter(isComputerCatalogProject)
      .map(project => [project.id, project])
  )

  for (const project of projects) {
    if (project.id && isComputerCatalogProject(project)) {
      byId.set(project.id, project)
    }
  }

  storage()?.setItem(STORAGE_KEY, JSON.stringify([...byId.values()]))
}

/** Computer projects plus catalog rows the current page did not return. Hosted copies stay out. */
export function mergeWithDesktopCatalog(incoming: ProjectInfo[]): ProjectInfo[] {
  const computerIncoming = incoming.filter(isComputerCatalogProject)
  const seen = new Set(computerIncoming.map(project => project.id))

  const extra = readDesktopProjectCatalog().filter(
    project => project.id && isComputerCatalogProject(project) && !seen.has(project.id)
  )

  return extra.length ? [...computerIncoming, ...extra] : computerIncoming
}
