/** Safe in-app return path after Portal login (blocks protocol-relative URLs). */
export function safePortalNextPath(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim()
  if (!value.startsWith('/') || value.startsWith('//')) {
    return null
  }
  return value
}

export function deviceVerificationPath(userCode: string): string {
  const code = userCode.trim()
  return code ? `/device?user_code=${encodeURIComponent(code)}` : '/device'
}

export function normalizeDeviceUserCode(raw: string): string {
  return raw.toUpperCase()
}

export function canSubmitDeviceUserCode(userCode: string): boolean {
  return userCode.replace(/[^A-Z0-9]/gi, '').length >= 8
}
