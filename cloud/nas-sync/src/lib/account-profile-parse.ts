export type AccountProfileName = {
  firstName: string
  lastName: string
}

const MAX_NAME_LEN = 80

export function normalizeAccountNamePart(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LEN)
}

export function parseAccountProfileBody(body: unknown): AccountProfileName | null {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  const firstName = normalizeAccountNamePart(record.firstName ?? record.first_name)
  const lastName = normalizeAccountNamePart(record.lastName ?? record.last_name)
  if (!firstName || !lastName) return null
  return { firstName, lastName }
}

export type AccountIdentity = {
  firstName: string | null
  lastName: string | null
  email: string | null
}

function emailAddress(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const address = (value as { address?: unknown; email?: unknown }).address
  const email = (value as { email?: unknown }).email
  const raw = typeof address === 'string' ? address : typeof email === 'string' ? email : ''
  const trimmed = raw.trim()
  return trimmed || null
}

/** Cadastro name when both parts exist, plus the Privy email. Usernames are ignored. */
export function accountIdentityFromPrivyUser(user: unknown): AccountIdentity {
  const record = user && typeof user === 'object' ? (user as Record<string, unknown>) : {}
  const profile = parseAccountProfileBody(record.customMetadata)
  const email =
    emailAddress(record.email) ||
    emailAddress(record.google) ||
    emailAddress(record.github)
  return {
    firstName: profile?.firstName ?? null,
    lastName: profile?.lastName ?? null,
    email,
  }
}
