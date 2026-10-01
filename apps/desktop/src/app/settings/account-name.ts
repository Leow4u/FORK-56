const ACCOUNT_NAME_MAX = 80
const DEFAULT_PORTAL = 'https://portal.work4you.ai'

/** One cadastro part, matching the Portal and electron/connection-config. */
export function normalizeAccountNamePart(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, ACCOUNT_NAME_MAX)
}

/** Both parts, or nothing. PATCH /api/account rejects a single name. */
export function accountProfilePatchBody(
  firstName: string,
  lastName: string
): { firstName: string; lastName: string } | null {
  const first = normalizeAccountNamePart(firstName)
  const last = normalizeAccountNamePart(lastName)

  if (!first || !last) {
    return null
  }

  return { firstName: first, lastName: last }
}

/**
 * Account settings on the Portal. `personal` is rewritten to this person's
 * org once the browser session is signed in.
 */
export function portalAccountSettingsUrl(portalUrl?: null | string): string {
  const base = (portalUrl?.trim() || DEFAULT_PORTAL).replace(/\/+$/, '')

  return `${base}/orgs/personal/settings`
}
