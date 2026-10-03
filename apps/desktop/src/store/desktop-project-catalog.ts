import { $activeGatewayProfile, normalizeProfileKey } from '@/store/profile-identity'
import type { ProjectInfo } from '@/types/work4you'

// Projects remembered on this computer, so a project the gateway you are on
// did not return (a folder attached under Local, then opened on Cloud) still
// lists. A project is a row in ONE profile's projects.db, so the catalog is
// kept per profile: Local and Cloud of the same profile share it, two profiles
// never do. Before the key carried the profile, a brand-new profile inherited
// every project this computer had ever seen.
const STORAGE_KEY_PREFIX = 'work4you.desktop-projects'

// The pre-scope key held every profile's projects mixed together. It is
// dropped on first access rather than migrated: each profile's next
// projects.list refills its own catalog, and a migration would only carry the
// cross-profile leak forward.
const LEGACY_STORAGE_KEY = STORAGE_KEY_PREFIX

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** The catalog key for `profile` (the active gateway profile when omitted). */
export function desktopProjectCatalogKey(profile?: null | string): string {
  const key = normalizeProfileKey(profile === undefined ? $activeGatewayProfile.get() : profile)

  return `${STORAGE_KEY_PREFIX}.${key}`
}

function dropLegacyCatalog(store: Storage): void {
  try {
    store.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // Read-only storage: the stale key is harmless as long as nothing reads it.
  }
}

export function readDesktopProjectCatalog(profile?: null | string): ProjectInfo[] {
  const store = storage()

  if (!store) {
    return []
  }

  dropLegacyCatalog(store)
  const raw = store.getItem(desktopProjectCatalogKey(profile))

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

export function forgetDesktopProject(id: string, profile?: null | string): void {
  const next = readDesktopProjectCatalog(profile).filter(project => project.id !== id)

  storage()?.setItem(desktopProjectCatalogKey(profile), JSON.stringify(next))
}

export function rememberDesktopProjects(projects: ProjectInfo[], profile?: null | string): void {
  const byId = new Map(readDesktopProjectCatalog(profile).map(project => [project.id, project]))

  for (const project of projects) {
    if (project.id) {
      byId.set(project.id, project)
    }
  }

  storage()?.setItem(desktopProjectCatalogKey(profile), JSON.stringify([...byId.values()]))
}

/** The gateway page plus projects saved on this computer for the same profile that it did not return. */
export function mergeWithDesktopCatalog(incoming: ProjectInfo[], profile?: null | string): ProjectInfo[] {
  const seen = new Set(incoming.map(project => project.id))
  const extra = readDesktopProjectCatalog(profile).filter(project => project.id && !seen.has(project.id))

  return extra.length ? [...incoming, ...extra] : incoming
}
