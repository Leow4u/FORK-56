import {
  parseProfileName,
  type ProfileName,
} from './profile-name'

export const PENDING_PROFILE_KEY = 'work4you.pendingProfile'
export const LOCAL_PROFILE_PREFIX = 'work4you.profile:'

export interface ProfileStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function memoryStorage(): ProfileStorage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
}

function browserSession(): ProfileStorage | null {
  try {
    if (typeof sessionStorage === 'undefined') return null
    return sessionStorage
  } catch {
    return null
  }
}

function browserLocal(): ProfileStorage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

const fallback = memoryStorage()

function readStore(store: ProfileStorage | null, key: string): ProfileName | null {
  if (!store) return null
  try {
    const raw = store.getItem(key)
    if (!raw) return null
    return parseProfileName(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeStore(store: ProfileStorage | null, key: string, profile: ProfileName): void {
  if (!store) return
  try {
    store.setItem(key, JSON.stringify(profile))
  } catch {
    /* quota / private mode */
  }
}

export function savePendingProfile(
  profile: ProfileName,
  store: ProfileStorage | null = browserSession() ?? fallback,
): void {
  writeStore(store, PENDING_PROFILE_KEY, profile)
}

export function readPendingProfile(
  store: ProfileStorage | null = browserSession() ?? fallback,
): ProfileName | null {
  return readStore(store, PENDING_PROFILE_KEY)
}

export function clearPendingProfile(
  store: ProfileStorage | null = browserSession() ?? fallback,
): void {
  try {
    store?.removeItem(PENDING_PROFILE_KEY)
  } catch {
    /* ignore */
  }
}

export function localProfileKey(userId: string): string {
  return `${LOCAL_PROFILE_PREFIX}${userId}`
}

export function saveLocalProfile(
  userId: string,
  profile: ProfileName,
  store: ProfileStorage | null = browserLocal() ?? fallback,
): void {
  if (!userId) return
  writeStore(store, localProfileKey(userId), profile)
}

export function readLocalProfile(
  userId: string,
  store: ProfileStorage | null = browserLocal() ?? fallback,
): ProfileName | null {
  if (!userId) return null
  return readStore(store, localProfileKey(userId))
}
