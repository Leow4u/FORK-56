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
