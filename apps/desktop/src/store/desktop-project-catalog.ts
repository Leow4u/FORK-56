import type { ProjectInfo } from '@/types/work4you'

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
  const byId = new Map(readDesktopProjectCatalog().map(project => [project.id, project]))

  for (const project of projects) {
    if (project.id) {
      byId.set(project.id, project)
    }
  }

  storage()?.setItem(STORAGE_KEY, JSON.stringify([...byId.values()]))
}

/** The gateway page plus projects saved on this computer that it did not return. */
export function mergeWithDesktopCatalog(incoming: ProjectInfo[]): ProjectInfo[] {
  const seen = new Set(incoming.map(project => project.id))
  const extra = readDesktopProjectCatalog().filter(project => project.id && !seen.has(project.id))

  return extra.length ? [...incoming, ...extra] : incoming
}
