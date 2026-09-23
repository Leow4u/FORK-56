/** Account-menu trigger: the signup name when both parts were saved, otherwise the portal email. */
export function accountMenuLabel(status: { email?: null | string; name?: null | string }): null | string {
  const name = status.name?.trim()

  if (name) {
    return name
  }

  const email = status.email?.trim()

  return email || null
}
