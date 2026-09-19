export type AuthProviderId = 'github' | 'google' | 'discord' | 'passkey'

export const LAST_USED_PROVIDER_KEY = 'work4you.lastUsedProvider'

const PROVIDERS = new Set<AuthProviderId>(['github', 'google', 'discord', 'passkey'])

export function isAuthProviderId(value: unknown): value is AuthProviderId {
  return typeof value === 'string' && PROVIDERS.has(value as AuthProviderId)
}

export function readLastUsedProvider(
  store: { getItem(key: string): string | null } | null = defaultLocal(),
): AuthProviderId | null {
  if (!store) return null
  try {
    const value = store.getItem(LAST_USED_PROVIDER_KEY)
    return isAuthProviderId(value) ? value : null
  } catch {
    return null
  }
}

export function saveLastUsedProvider(
  provider: AuthProviderId,
  store: { setItem(key: string, value: string): void } | null = defaultLocal(),
): void {
  if (!store) return
  try {
    store.setItem(LAST_USED_PROVIDER_KEY, provider)
  } catch {
    /* ignore */
  }
}

function defaultLocal(): { getItem(key: string): string | null; setItem(key: string, value: string): void } | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}
