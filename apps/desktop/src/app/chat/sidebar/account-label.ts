/** Initials for the account mark. Signed out: one letter. Signed in: the first
 *  letter of the first two segments, or the first two letters of one segment. */
export function accountMark(label: string, signedIn: boolean): string {
  if (!signedIn) {
    return (label.match(/[a-z0-9]/i)?.[0] ?? '?').toUpperCase()
  }

  const source = label.includes('@') ? (label.split('@')[0] ?? label) : label
  const parts = source.split(/[\s._-]+/).filter(part => /[a-z0-9]/i.test(part))

  if (parts.length >= 2) {
    const first = parts[0]?.match(/[a-z0-9]/i)?.[0] ?? ''
    const second = parts[1]?.match(/[a-z0-9]/i)?.[0] ?? ''

    return `${first}${second}`.toUpperCase()
  }

  const letters = source.match(/[a-z0-9]/gi) ?? []

  return `${letters[0] ?? '?'}${letters[1] ?? ''}`.toUpperCase()
}

/** Account-menu trigger: the signup name when both parts were saved, otherwise the portal email. */
export function accountMenuLabel(status: { email?: null | string; name?: null | string }): null | string {
  const name = status.name?.trim()

  if (name) {
    return name
  }

  const email = status.email?.trim()

  return email || null
}
