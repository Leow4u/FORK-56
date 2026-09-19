export type ProfileName = {
  firstName: string
  lastName: string
}

const MAX_NAME_LEN = 80

export function normalizeNamePart(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LEN)
}

export function composeDisplayName(
  firstName: string,
  lastName: string,
): string | null {
  const first = normalizeNamePart(firstName)
  const last = normalizeNamePart(lastName)
  const full = [first, last].filter(Boolean).join(' ')
  return full || null
}

export function parseProfileName(input: unknown): ProfileName | null {
  if (!input || typeof input !== 'object') return null
  const record = input as Record<string, unknown>
  const firstName = normalizeNamePart(record.firstName ?? record.first_name)
  const lastName = normalizeNamePart(record.lastName ?? record.last_name)
  if (!firstName || !lastName) return null
  return { firstName, lastName }
}

export function profileFromFullName(fullName: unknown): ProfileName | null {
  const parts = normalizeNamePart(fullName).split(' ').filter(Boolean)
  if (parts.length < 2) return null
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

export function isValidEmail(value: string): boolean {
  const email = value.trim()
  const at = email.indexOf('@')
  return at > 0 && email.includes('.', at) && email.length >= 6 && !email.includes(' ')
}

export type PrivyProfileSource = {
  id?: string
  customMetadata?: Record<string, unknown> | null
  email?: { address?: string | null } | null
  google?: { email?: string | null; name?: string | null } | null
  github?: { username?: string | null; email?: string | null; name?: string | null } | null
  discord?: { username?: string | null } | null
}

export function profileFromCustomMetadata(
  user: PrivyProfileSource | null | undefined,
): ProfileName | null {
  return parseProfileName(user?.customMetadata)
}

export function profileFromOAuth(user: PrivyProfileSource | null | undefined): ProfileName | null {
  if (!user) return null
  return profileFromFullName(user.google?.name) || profileFromFullName(user.github?.name)
}

export function resolveProfileName(
  user: PrivyProfileSource | null | undefined,
  extras: Array<ProfileName | null | undefined> = [],
): ProfileName | null {
  return (
    profileFromCustomMetadata(user) ||
    extras.find((item): item is ProfileName => Boolean(item)) ||
    profileFromOAuth(user)
  )
}
